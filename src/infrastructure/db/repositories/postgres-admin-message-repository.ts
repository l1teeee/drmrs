import type { PoolClient } from "pg";

import type {
  AdminMessageMutationKind,
  AdminMessageStore,
  Conversation,
  ConversationMessage,
  ConversationSummary,
  EnqueueMessageResult,
  LinkableContact,
  QueuedMessageStatus,
  RegistrationWindowState,
  UnlinkedContact,
  UnsentMessage,
} from "@/application/messaging/admin-messages";
import type { TemplateKey } from "@/domain/messaging/message-template";
import { isMessagingWindowOpen } from "@/domain/messaging/messaging-window";

import { getPool } from "../client";
import { inTransaction } from "../transaction";
import { backfillContactMessages, linkSiblingRegistrations, releasePending } from "./postgres-messaging-repository";

const transactionSettings = ["SET LOCAL lock_timeout = '3s'", "SET LOCAL statement_timeout = '5s'"];
const mutableStatuses = new Set(["FAILED", "WAITING_CONTACT", "WAITING_WINDOW", "QUEUED"]);

async function insertAudit(
  client: PoolClient,
  adminId: string | null,
  registrationId: string,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'registration', $3, $4::jsonb)`,
    [adminId, action, registrationId, JSON.stringify(metadata)],
  );
}

async function discardPendingMessage(adminId: string, messageId: string): Promise<AdminMessageMutationKind> {
  return inTransaction(getPool(), transactionSettings, async (client) => {
    const result = await client.query<{
      registration_id: string;
      direction: string;
      source: string;
      status: string;
      locked: boolean;
    }>(
      `SELECT registration_id, direction, source, status,
              (locked_until IS NOT NULL AND locked_until >= now()) AS locked
         FROM messages WHERE id = $1 FOR UPDATE`,
      [messageId],
    );
    const message = result.rows[0];
    if (!message) return "not_found";
    if (message.direction !== "OUT" || message.source !== "ADMIN" || !mutableStatuses.has(message.status)) {
      return "invalid_state";
    }
    if (message.locked) return "conflict";
    await client.query("DELETE FROM messages WHERE id = $1", [messageId]);
    await insertAudit(client, adminId, message.registration_id, "INSTAGRAM_MESSAGE_DISCARDED");
    return "done";
  });
}

export class PostgresAdminMessageRepository implements AdminMessageStore {
  enqueue(
    adminId: string | null,
    registrationId: string,
    text: string,
    templateKey: TemplateKey | null,
  ): Promise<EnqueueMessageResult> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query<{
        messaging_contact_id: string | null;
        last_inbound_at: Date | null;
        now: Date;
      }>(
        `SELECT r.messaging_contact_id, c.last_inbound_at, now() AS now
           FROM registrations r LEFT JOIN messaging_contacts c ON c.id = r.messaging_contact_id
          WHERE r.id = $1 FOR UPDATE OF r`,
        [registrationId],
      );
      const registration = result.rows[0];
      if (!registration) return { kind: "not_found" };
      let status: QueuedMessageStatus;
      if (!registration.messaging_contact_id) status = "WAITING_CONTACT";
      else if (!isMessagingWindowOpen(registration.last_inbound_at, registration.now)) status = "WAITING_WINDOW";
      else status = "QUEUED";
      await client.query(
        `INSERT INTO messages (
           registration_id, contact_id, direction, source, status, body,
           created_by, template_key, next_attempt_at
         ) VALUES ($1, $2, 'OUT', 'ADMIN', $3, $4, $5, $6,
                   CASE WHEN $3::text = 'QUEUED' THEN now() ELSE NULL END)`,
        [registrationId, registration.messaging_contact_id, status, text, adminId, templateKey],
      );
      await insertAudit(client, adminId, registrationId, "INSTAGRAM_MESSAGE_QUEUED", {
        template: templateKey, status, ...(adminId === null ? { via: "auto" } : {}),
      });
      return { kind: "queued", status };
    });
  }

  discardMessage(adminId: string, messageId: string): Promise<AdminMessageMutationKind> {
    return discardPendingMessage(adminId, messageId);
  }

  deleteRegistrationChat(
    adminId: string,
    registrationId: string,
  ): Promise<{ kind: "done"; deleted: number } | { kind: "not_found" }> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const registrations = await client.query<{ messaging_contact_id: string | null }>(
        "SELECT messaging_contact_id FROM registrations WHERE id = $1 FOR UPDATE", [registrationId],
      );
      const registration = registrations.rows[0];
      if (!registration) return { kind: "not_found" };
      const result = await client.query(
        `DELETE FROM messages
          WHERE (registration_id = $1 OR ($2::uuid IS NOT NULL AND contact_id = $2))
            AND status NOT IN ('QUEUED', 'WAITING_CONTACT', 'WAITING_WINDOW')
            AND NOT (locked_until IS NOT NULL AND locked_until >= now())`,
        [registrationId, registration.messaging_contact_id],
      );
      const deleted = result.rowCount ?? 0;
      await insertAudit(client, adminId, registrationId, "INSTAGRAM_CHAT_DELETED", {
        deleted,
        ...(registration.messaging_contact_id !== null ? { scope: "contact" } : {}),
      });
      return { kind: "done", deleted };
    });
  }

  deleteUnlinkedContact(adminId: string, contactId: string): Promise<"done" | "not_found" | "conflict"> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const deleted = await client.query(
        `DELETE FROM messaging_contacts c
          WHERE c.id = $1
            AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.messaging_contact_id = c.id)`,
        [contactId],
      );
      if (deleted.rowCount === 1) {
        await client.query(
          `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id)
           VALUES ($1, 'INSTAGRAM_CONTACT_DELETED', 'messaging_contact', $2)`,
          [adminId, contactId],
        );
        return "done";
      }
      const existing = await client.query("SELECT 1 FROM messaging_contacts WHERE id = $1", [contactId]);
      return existing.rows.length > 0 ? "conflict" : "not_found";
    });
  }

  async listWindowStates(registrationIds: string[]): Promise<RegistrationWindowState[]> {
    if (registrationIds.length === 0) return [];
    const result = await getPool().query<RegistrationWindowState>(
      `SELECT r.id AS "registrationId", c.last_inbound_at AS "lastInboundAt",
              r.instagram_activation_sent_at AS "activationSentAt"
         FROM registrations r LEFT JOIN messaging_contacts c ON c.id = r.messaging_contact_id
        WHERE r.id = ANY($1::uuid[])`,
      [registrationIds],
    );
    return result.rows;
  }

  recordActivationSent(adminId: string, registrationId: string): Promise<"done" | "not_found"> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query(
        "UPDATE registrations SET instagram_activation_sent_at = now() WHERE id = $1",
        [registrationId],
      );
      if (result.rowCount !== 1) return "not_found";
      await insertAudit(client, adminId, registrationId, "INSTAGRAM_ACTIVATION_SENT");
      return "done";
    });
  }

  linkContactManually(adminId: string, registrationId: string, contactId: string): Promise<AdminMessageMutationKind> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const contacts = await client.query<{ id: string; username: string | null }>(
        "SELECT id, username FROM messaging_contacts WHERE id = $1 FOR UPDATE",
        [contactId],
      );
      const contact = contacts.rows[0];
      if (!contact) return "not_found";
      const registrations = await client.query<{ messaging_contact_id: string | null; drop_id: string }>(
        "SELECT messaging_contact_id, drop_id FROM registrations WHERE id = $1 FOR UPDATE",
        [registrationId],
      );
      const registration = registrations.rows[0];
      if (!registration) return "not_found";
      if (registration.messaging_contact_id) return "conflict";
      const linked = await client.query(
        "SELECT 1 FROM registrations WHERE messaging_contact_id = $1 AND drop_id = $2",
        [contactId, registration.drop_id],
      );
      if (linked.rows.length > 0) return "conflict";
      await client.query("SAVEPOINT contact_link");
      try {
        await client.query(
          "UPDATE registrations SET messaging_contact_id = $2, contact_linked_by = 'MANUAL' WHERE id = $1",
          [registrationId, contactId],
        );
        await insertAudit(client, adminId, registrationId, "INSTAGRAM_CONTACT_LINKED", { by: "MANUAL" });
        if (contact.username !== null) await linkSiblingRegistrations(client, contactId, contact.username, adminId);
      } catch (error) {
        if (
          typeof error !== "object" || error === null ||
          !("code" in error) || error.code !== "23505" ||
          !("constraint" in error) || error.constraint !== "registrations_drop_contact_uq"
        ) throw error;
        await client.query("ROLLBACK TO SAVEPOINT contact_link");
        await client.query("RELEASE SAVEPOINT contact_link");
        return "conflict";
      }
      await client.query("RELEASE SAVEPOINT contact_link");
      await backfillContactMessages(client, contactId);
      await releasePending(client, contactId);
      return "done";
    });
  }

  async getConversation(registrationId: string): Promise<Conversation | null> {
    const registrations = await getPool().query<{
      id: string;
      registration_number: number;
      drop_number: number;
      drop_name: string;
      full_name: string;
      instagram_handle: string;
      contact_linked_by: string | null;
      username: string | null;
      last_inbound_at: Date | null;
      ig_link_code: string | null;
      instagram_activation_sent_at: Date | null;
    }>(
      `SELECT r.id, r.registration_number, r.full_name, r.instagram_handle, r.contact_linked_by,
              d.number AS drop_number, d.name AS drop_name,
              c.username, c.last_inbound_at, r.ig_link_code, r.instagram_activation_sent_at
         FROM registrations r JOIN drops d ON d.id = r.drop_id
         LEFT JOIN messaging_contacts c ON c.id = r.messaging_contact_id
        WHERE r.id = $1`,
      [registrationId],
    );
    const registration = registrations.rows[0];
    if (!registration) return null;
    const messages = await getPool().query<ConversationMessage>(
      `SELECT id, "registrationId", "dropNumber", direction, source, status, body,
              "templateKey", "createdAt", "sentAt", "receivedAt", "readAt", "lastError"
         FROM (
           SELECT m.id, m.registration_id AS "registrationId", md.number AS "dropNumber",
                  m.direction, m.source, m.status, m.body, m.template_key AS "templateKey",
                  m.created_at AS "createdAt", m.sent_at AS "sentAt", m.received_at AS "receivedAt",
                  m.read_at AS "readAt", m.last_error AS "lastError",
                  COALESCE(m.sent_at, m.received_at, m.created_at) AS orden,
                  m.status IN ('QUEUED', 'WAITING_CONTACT', 'WAITING_WINDOW') AS pendiente
             FROM registrations r
             JOIN messages m ON (m.registration_id = r.id OR (r.messaging_contact_id IS NOT NULL AND m.contact_id = r.messaging_contact_id))
             LEFT JOIN registrations mr ON mr.id = m.registration_id
             LEFT JOIN drops md ON md.id = mr.drop_id
            WHERE r.id = $1
            ORDER BY pendiente DESC, orden DESC, m.id DESC
            LIMIT 200
         ) ultimos
        ORDER BY pendiente ASC, orden ASC, id ASC`,
      [registrationId],
    );
    return {
      registration: {
        id: registration.id,
        registrationNumber: registration.registration_number,
        dropNumber: registration.drop_number,
        dropName: registration.drop_name,
        fullName: registration.full_name,
        instagramHandle: registration.instagram_handle,
        linkedBy: registration.contact_linked_by,
        contactUsername: registration.username,
        lastInboundAt: registration.last_inbound_at,
        activationSentAt: registration.instagram_activation_sent_at,
        linkCode: registration.ig_link_code,
      },
      messages: messages.rows,
    };
  }

  async listUnsentMessages(): Promise<UnsentMessage[]> {
    const result = await getPool().query<UnsentMessage>(
      `SELECT m.id, m.registration_id AS "registrationId", r.registration_number AS "registrationNumber",
              d.number AS "dropNumber", d.name AS "dropName",
              r.full_name AS "fullName", r.instagram_handle AS "instagramHandle",
              m.status, m.body, m.attempts, m.last_error AS "lastError", m.created_at AS "createdAt",
              c.last_inbound_at AS "lastInboundAt",
              r.instagram_activation_sent_at AS "activationSentAt"
         FROM messages m JOIN registrations r ON r.id = m.registration_id
         JOIN drops d ON d.id = r.drop_id
         LEFT JOIN messaging_contacts c ON c.id = r.messaging_contact_id
        WHERE m.direction = 'OUT'
          AND (m.status IN ('FAILED', 'WAITING_CONTACT', 'WAITING_WINDOW')
               OR (m.status = 'QUEUED' AND m.attempts > 0))
        ORDER BY m.created_at DESC, m.id DESC`,
    );
    return result.rows;
  }

  async listUnlinkedContacts(): Promise<UnlinkedContact[]> {
    const result = await getPool().query<UnlinkedContact>(
      `SELECT c.id, c.username, c.display_name AS "displayName", c.last_inbound_at AS "lastInboundAt",
              preview.body AS "lastInboundText"
         FROM messaging_contacts c
         LEFT JOIN LATERAL (
           SELECT left(m.body, 80) AS body FROM messages m
            WHERE m.contact_id = c.id AND m.direction = 'IN'
            ORDER BY m.created_at DESC, m.id DESC LIMIT 1
         ) preview ON true
        WHERE c.last_inbound_at >= now() - interval '30 days'
          AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.messaging_contact_id = c.id)
        ORDER BY c.last_inbound_at DESC, c.id LIMIT 200`,
    );
    return result.rows;
  }

  async listLinkableContacts(registrationId: string): Promise<LinkableContact[]> {
    const result = await getPool().query<LinkableContact>(
      `SELECT c.id, c.username, c.display_name AS "displayName", c.last_inbound_at AS "lastInboundAt",
              preview.body AS "lastInboundText",
              COALESCE((
                SELECT array_agg(lpad(d.number::text, 3, '0') || '·' || lpad(r.registration_number::text, 4, '0')
                                 ORDER BY d.number, r.registration_number)
                  FROM registrations r JOIN drops d ON d.id = r.drop_id
                 WHERE r.messaging_contact_id = c.id
              ), '{}'::text[]) AS "linkedTags"
         FROM messaging_contacts c
         LEFT JOIN LATERAL (
           SELECT left(m.body, 80) AS body FROM messages m
            WHERE m.contact_id = c.id AND m.direction = 'IN'
            ORDER BY m.created_at DESC, m.id DESC LIMIT 1
         ) preview ON true
        WHERE c.last_inbound_at >= now() - interval '30 days'
          AND NOT EXISTS (
            SELECT 1 FROM registrations x WHERE x.messaging_contact_id = c.id
              AND x.drop_id = (SELECT drop_id FROM registrations WHERE id = $1)
          )
        ORDER BY c.last_inbound_at DESC, c.id LIMIT 200`,
      [registrationId],
    );
    return result.rows;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const result = await getPool().query<ConversationSummary>(
      `WITH ultimos AS (
         SELECT DISTINCT ON (COALESCE(m.contact_id::text, 'r:' || m.registration_id::text))
                COALESCE(m.contact_id::text, 'r:' || m.registration_id::text) AS chat_key,
                m.registration_id, m.contact_id, m.direction, m.body, m.created_at
           FROM messages m
          WHERE m.registration_id IS NOT NULL OR m.contact_id IS NOT NULL
          ORDER BY COALESCE(m.contact_id::text, 'r:' || m.registration_id::text), m.created_at DESC, m.id DESC
       )
       SELECT r.id AS "registrationId",
              CASE WHEN r.id IS NULL THEN u.contact_id END AS "contactId",
              r.registration_number AS "registrationNumber", r.full_name AS "fullName",
              r.drop_number AS "dropNumber", r.drop_name AS "dropName",
              r.instagram_handle AS "instagramHandle",
              c.username AS "contactUsername", c.display_name AS "contactDisplayName",
              u.direction AS "lastDirection", left(u.body, 140) AS "lastBody", u.created_at AS "lastAt",
              (SELECT count(*)::int FROM messages x
                WHERE (u.contact_id IS NOT NULL AND x.contact_id = u.contact_id)
                   OR (u.contact_id IS NULL AND x.contact_id IS NULL AND x.registration_id = u.registration_id)) AS total
         FROM ultimos u
         LEFT JOIN LATERAL (
           SELECT r.id, r.registration_number, r.full_name, r.instagram_handle,
                  d.number AS drop_number, d.name AS drop_name
             FROM registrations r JOIN drops d ON d.id = r.drop_id
            WHERE (u.contact_id IS NOT NULL AND r.messaging_contact_id = u.contact_id)
               OR (u.contact_id IS NULL AND r.id = u.registration_id)
            ORDER BY d.number DESC LIMIT 1
         ) r ON true
         LEFT JOIN messaging_contacts c ON c.id = u.contact_id
        ORDER BY u.created_at DESC`,
    );
    return result.rows;
  }
}

export const postgresAdminMessageRepository = new PostgresAdminMessageRepository();
