import type { PoolClient } from "pg";

import type {
  InstagramEventRepository,
  InstagramIngestionTransactionResult,
} from "@/application/messaging/instagram-event-ingestion";
import type { InstagramWebhookEvent } from "@/application/messaging/instagram-events";
import { extractLinkCode, isLinkCode } from "@/domain/messaging/link-code";
import { isMessagingWindowOpen } from "@/domain/messaging/messaging-window";
import { generateLinkCode } from "@/infrastructure/crypto/link-code-generator";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";

import { getPool } from "../client";
import { inTransaction } from "../transaction";

const transactionSettings = [
  "SET LOCAL lock_timeout = '3s'",
  "SET LOCAL statement_timeout = '5s'",
] as const;

interface ContactRow {
  id: string;
  instagram_scoped_id: string;
  username: string | null;
}

function contactScopedId(event: InstagramWebhookEvent): string | null {
  if (event.type === "message_edit") return null;
  return event.type === "echo" ? event.recipientId : event.senderId;
}

function linkCodeFromEvent(event: InstagramWebhookEvent): string | null {
  if (event.type === "referral") {
    const code = event.ref.toUpperCase();
    return isLinkCode(code) ? code : null;
  }
  if (event.type !== "inbound_message") return null;
  for (const candidate of [event.quickReplyPayload, event.referralRef]) {
    if (candidate && isLinkCode(candidate.toUpperCase())) return candidate.toUpperCase();
  }
  return event.text ? extractLinkCode(event.text) : null;
}

async function finishLink(
  client: PoolClient,
  registrationId: string,
  contactId: string,
  by: "CODE" | "USERNAME",
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
     VALUES (NULL, 'INSTAGRAM_CONTACT_LINKED', 'registration', $1, $2::jsonb)`,
    [registrationId, JSON.stringify({ by })],
  );
  await client.query(
    "UPDATE messages SET registration_id = $2 WHERE contact_id = $1 AND registration_id IS NULL",
    [contactId, registrationId],
  );
}

async function linkByCode(client: PoolClient, contactId: string, code: string): Promise<void> {
  const result = await client.query<{ id: string }>(
    `UPDATE registrations SET messaging_contact_id = $1, contact_linked_by = 'CODE'
       WHERE ig_link_code = $2 AND messaging_contact_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM registrations WHERE messaging_contact_id = $1)
     RETURNING id`,
    [contactId, code],
  );
  const registration = result.rows[0];
  if (registration) await finishLink(client, registration.id, contactId, "CODE");
}

async function releasePending(client: PoolClient, contactId: string): Promise<number> {
  const result = await client.query<{ last_inbound_at: Date | null; now: Date }>(
    "SELECT last_inbound_at, now() AS now FROM messaging_contacts WHERE id = $1",
    [contactId],
  );
  const contact = result.rows[0];
  if (!contact) return 0;
  const open = isMessagingWindowOpen(contact.last_inbound_at, contact.now);
  const waiting = await client.query(
    `UPDATE messages
        SET contact_id = $1, status = $2,
            next_attempt_at = CASE WHEN $3::boolean THEN now() ELSE NULL END
      WHERE registration_id = (SELECT id FROM registrations WHERE messaging_contact_id = $1)
        AND direction = 'OUT' AND status = 'WAITING_CONTACT'`,
    [contactId, open ? "QUEUED" : "WAITING_WINDOW", open],
  );
  if (!open) return 0;
  const window = await client.query(
    `UPDATE messages SET status = 'QUEUED', next_attempt_at = now()
      WHERE contact_id = $1 AND direction = 'OUT' AND status = 'WAITING_WINDOW'`,
    [contactId],
  );
  return (waiting.rowCount ?? 0) + (window.rowCount ?? 0);
}

async function updateInboundTime(client: PoolClient, contactId: string, timestamp: Date): Promise<void> {
  await client.query(
    `UPDATE messaging_contacts
        SET last_inbound_at = GREATEST(last_inbound_at, $2::timestamptz), updated_at = now()
      WHERE id = $1`,
    [contactId, timestamp],
  );
}

async function ingestEvent(
  client: PoolClient,
  event: InstagramWebhookEvent,
  contacts: ReadonlyMap<string, ContactRow>,
): Promise<number> {
  if (event.type === "message_edit") {
    await client.query(
      "UPDATE messages SET body = $2 WHERE external_message_id = $1 AND direction = 'IN'",
      [event.externalMessageId, event.text],
    );
    return 0;
  }
  const contact = contacts.get(contactScopedId(event)!);
  if (!contact) return 0;

  if (event.type === "inbound_message") {
    await updateInboundTime(client, contact.id, event.timestamp);
    await client.query(
      `INSERT INTO messages (
         registration_id, contact_id, direction, source, status, body,
         external_message_id, received_at, created_at
       ) VALUES (
         (SELECT id FROM registrations WHERE messaging_contact_id = $1),
         $1, 'IN', 'CONTACT', 'RECEIVED', $2, $3, now(), $4
       ) ON CONFLICT (external_message_id) WHERE external_message_id IS NOT NULL DO NOTHING`,
      [contact.id, event.text || "[adjunto]", event.externalMessageId, event.timestamp],
    );
    const code = linkCodeFromEvent(event);
    if (code) await linkByCode(client, contact.id, code);
    return releasePending(client, contact.id);
  }
  if (event.type === "referral" || event.type === "window_signal") {
    await updateInboundTime(client, contact.id, event.timestamp);
    const code = linkCodeFromEvent(event);
    if (code) await linkByCode(client, contact.id, code);
    return releasePending(client, contact.id);
  }
  if (event.type === "echo") {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [event.externalMessageId]);
    const exists = await client.query(
      "SELECT 1 FROM messages WHERE external_message_id = $1 OR $1 = ANY(external_part_ids)",
      [event.externalMessageId],
    );
    if (exists.rows.length > 0) return 0;
    await client.query(
      `INSERT INTO messages (
         registration_id, contact_id, direction, source, status, body,
         external_message_id, sent_at, created_at
       ) VALUES (
         (SELECT id FROM registrations WHERE messaging_contact_id = $1),
         $1, 'OUT', 'INSTAGRAM_APP', 'SENT', $2, $3, $4, $4
       ) ON CONFLICT (external_message_id) WHERE external_message_id IS NOT NULL DO NOTHING`,
      [contact.id, event.text || "[adjunto]", event.externalMessageId, event.timestamp],
    );
  } else if (event.type === "read") {
    await client.query(
      `UPDATE messages SET read_at = now()
        WHERE contact_id = $1 AND direction = 'OUT' AND sent_at <= $2 AND read_at IS NULL`,
      [contact.id, event.timestamp],
    );
  } else if (event.type === "deleted") {
    await client.query(
      "DELETE FROM messages WHERE external_message_id = $1 AND direction = 'IN' AND contact_id = $2",
      [event.externalMessageId, contact.id],
    );
  }
  return 0;
}

async function skipBadEvent(client: PoolClient, error: unknown): Promise<void> {
  const code = safeErrorCode(error);
  if (!code.startsWith("22") && !code.startsWith("23")) throw error;
  await client.query("ROLLBACK TO SAVEPOINT instagram_event");
  await client.query("RELEASE SAVEPOINT instagram_event");
  log("warn", "instagram_webhook_item_skipped", { code });
}

export class PostgresMessagingRepository implements InstagramEventRepository {
  ingestEvents(
    events: readonly InstagramWebhookEvent[],
    ownAccountId: string | null,
  ): Promise<InstagramIngestionTransactionResult> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const contacts = new Map<string, ContactRow>();
      const scopedIds = new Set<string>();
      for (const event of events) {
        const scopedId = contactScopedId(event);
        if (scopedId && scopedId !== ownAccountId) scopedIds.add(scopedId);
      }
      for (const scopedId of [...scopedIds].sort()) {
        await client.query("SAVEPOINT instagram_event");
        try {
          const result = await client.query<ContactRow>(
            `INSERT INTO messaging_contacts (instagram_scoped_id) VALUES ($1)
             ON CONFLICT (instagram_scoped_id) DO UPDATE SET updated_at = now()
             RETURNING id, instagram_scoped_id, username`,
            [scopedId],
          );
          await client.query("RELEASE SAVEPOINT instagram_event");
          contacts.set(scopedId, result.rows[0]!);
        } catch (error) {
          await skipBadEvent(client, error);
        }
      }

      let released = 0;
      for (const event of events) {
        if (ownAccountId !== null && contactScopedId(event) === ownAccountId) continue;
        await client.query("SAVEPOINT instagram_event");
        try {
          const eventReleased = await ingestEvent(client, event, contacts);
          await client.query("RELEASE SAVEPOINT instagram_event");
          released += eventReleased;
        } catch (error) {
          await skipBadEvent(client, error);
        }
      }
      return {
        contacts: [...contacts.values()].map((contact) => ({
          contactId: contact.id, recipientId: contact.instagram_scoped_id, username: contact.username,
        })),
        released,
      };
    });
  }

  async storeProfile(contactId: string, username: string | null, displayName: string | null): Promise<void> {
    await getPool().query(
      "UPDATE messaging_contacts SET username = $2, display_name = $3, updated_at = now() WHERE id = $1",
      [contactId, username, displayName],
    );
  }

  linkByUsername(contactId: string, username: string): Promise<number> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const contact = await client.query("SELECT id FROM messaging_contacts WHERE id = $1 FOR UPDATE", [contactId]);
      if (contact.rows.length === 0) return 0;
      const linked = await client.query<{ id: string }>(
        `UPDATE registrations SET messaging_contact_id = $1, contact_linked_by = 'USERNAME'
           WHERE instagram_handle = $2 AND messaging_contact_id IS NULL
             AND (SELECT count(*) FROM registrations WHERE instagram_handle = $2) = 1
             AND NOT EXISTS (SELECT 1 FROM registrations WHERE messaging_contact_id = $1)
         RETURNING id`,
        [contactId, username],
      );
      const registration = linked.rows[0];
      if (!registration) return 0;
      await finishLink(client, registration.id, contactId, "USERNAME");
      return releasePending(client, contactId);
    });
  }

  linkRegistrationContactByUsername(registrationId: string): Promise<boolean> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const registrations = await client.query<{ instagram_handle: string }>(
        "SELECT instagram_handle FROM registrations WHERE id = $1 AND messaging_contact_id IS NULL",
        [registrationId],
      );
      const registration = registrations.rows[0];
      if (!registration) return false;
      // The contact is locked before the registration, as in linkByUsername, so both paths take locks in the same order.
      const contacts = await client.query<{ id: string }>(
        `SELECT c.id FROM messaging_contacts c
          WHERE c.username = $1
            AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.messaging_contact_id = c.id)
          ORDER BY c.last_inbound_at DESC NULLS LAST, c.id LIMIT 1
          FOR UPDATE OF c`,
        [registration.instagram_handle],
      );
      const contact = contacts.rows[0];
      if (!contact) return false;
      const linked = await client.query(
        `UPDATE registrations SET messaging_contact_id = $1, contact_linked_by = 'USERNAME'
           WHERE id = $2 AND messaging_contact_id IS NULL`,
        [contact.id, registrationId],
      );
      if (linked.rowCount !== 1) return false;
      await finishLink(client, registrationId, contact.id, "USERNAME");
      await releasePending(client, contact.id);
      return true;
    });
  }

  ensureLinkCode(id: string): Promise<string> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query<{ ig_link_code: string | null }>(
        "SELECT ig_link_code FROM registrations WHERE id = $1 FOR UPDATE", [id],
      );
      const registration = result.rows[0];
      if (!registration) throw new Error("Registration not found");
      if (registration.ig_link_code) return registration.ig_link_code;
      for (let attempt = 0; ; attempt += 1) {
        const code = generateLinkCode();
        await client.query("SAVEPOINT registration_link_code");
        try {
          await client.query("UPDATE registrations SET ig_link_code = $2 WHERE id = $1 AND ig_link_code IS NULL", [id, code]);
          await client.query("RELEASE SAVEPOINT registration_link_code");
          return code;
        } catch (error) {
          await client.query("ROLLBACK TO SAVEPOINT registration_link_code");
          await client.query("RELEASE SAVEPOINT registration_link_code");
          if (
            attempt >= 3 || typeof error !== "object" || error === null ||
            !("code" in error) || error.code !== "23505" ||
            !("constraint" in error) || error.constraint !== "registrations_ig_link_code_uq"
          ) throw error;
        }
      }
    });
  }
}

export const postgresMessagingRepository = new PostgresMessagingRepository();
