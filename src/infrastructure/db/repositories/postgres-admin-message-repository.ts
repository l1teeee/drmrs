import type { PoolClient } from "pg";

import type {
  AdminMessageMutationKind,
  AdminMessageStore,
  Conversation,
  ConversationMessage,
  EnqueueMessageResult,
  QueuedMessageStatus,
  RegistrationWindowState,
  UnlinkedContact,
  UnsentMessage,
} from "@/application/messaging/admin-messages";
import type { TemplateKey } from "@/domain/messaging/message-template";
import { isMessagingWindowOpen } from "@/domain/messaging/messaging-window";

import { getPool } from "../client";
import { inTransaction } from "../transaction";

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
      const contacts = await client.query<{ last_inbound_at: Date | null; now: Date }>(
        "SELECT last_inbound_at, now() AS now FROM messaging_contacts WHERE id = $1 FOR UPDATE",
        [contactId],
      );
      const contact = contacts.rows[0];
      if (!contact) return "not_found";
      const registrations = await client.query<{ messaging_contact_id: string | null }>(
        "SELECT messaging_contact_id FROM registrations WHERE id = $1 FOR UPDATE",
        [registrationId],
      );
      const registration = registrations.rows[0];
      if (!registration) return "not_found";
      if (registration.messaging_contact_id) return "conflict";
      const linked = await client.query("SELECT 1 FROM registrations WHERE messaging_contact_id = $1", [contactId]);
      if (linked.rows.length > 0) return "conflict";
      await client.query(
        "UPDATE registrations SET messaging_contact_id = $2, contact_linked_by = 'MANUAL' WHERE id = $1",
        [registrationId, contactId],
      );
      await client.query(
        "UPDATE messages SET registration_id = $2 WHERE contact_id = $1 AND registration_id IS NULL",
        [contactId, registrationId],
      );
      const open = isMessagingWindowOpen(contact.last_inbound_at, contact.now);
      await client.query(
        `UPDATE messages SET contact_id = $1, status = $2,
                next_attempt_at = CASE WHEN $3::boolean THEN now() ELSE NULL END
          WHERE registration_id = (SELECT id FROM registrations WHERE messaging_contact_id = $1)
            AND direction = 'OUT' AND status = 'WAITING_CONTACT'`,
        [contactId, open ? "QUEUED" : "WAITING_WINDOW", open],
      );
      if (open) {
        await client.query(
          `UPDATE messages SET status = 'QUEUED', next_attempt_at = now()
            WHERE contact_id = $1 AND direction = 'OUT' AND status = 'WAITING_WINDOW'`,
          [contactId],
        );
      }
      await insertAudit(client, adminId, registrationId, "INSTAGRAM_CONTACT_LINKED", { by: "MANUAL" });
      return "done";
    });
  }

  async getConversation(registrationId: string): Promise<Conversation | null> {
    const registrations = await getPool().query<{
      id: string;
      registration_number: number;
      full_name: string;
      instagram_handle: string;
      contact_linked_by: string | null;
      username: string | null;
      last_inbound_at: Date | null;
      ig_link_code: string | null;
      instagram_activation_sent_at: Date | null;
    }>(
      `SELECT r.id, r.registration_number, r.full_name, r.instagram_handle, r.contact_linked_by,
              c.username, c.last_inbound_at, r.ig_link_code, r.instagram_activation_sent_at
         FROM registrations r LEFT JOIN messaging_contacts c ON c.id = r.messaging_contact_id
        WHERE r.id = $1`,
      [registrationId],
    );
    const registration = registrations.rows[0];
    if (!registration) return null;
    const messages = await getPool().query<ConversationMessage>(
      `SELECT id, direction, source, status, body, created_at AS "createdAt",
              sent_at AS "sentAt", read_at AS "readAt", last_error AS "lastError"
         FROM messages WHERE registration_id = $1
        ORDER BY created_at, id LIMIT 200`,
      [registrationId],
    );
    return {
      registration: {
        id: registration.id,
        registrationNumber: registration.registration_number,
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
              r.full_name AS "fullName", r.instagram_handle AS "instagramHandle",
              m.status, m.body, m.attempts, m.last_error AS "lastError", m.created_at AS "createdAt",
              c.last_inbound_at AS "lastInboundAt",
              r.instagram_activation_sent_at AS "activationSentAt"
         FROM messages m JOIN registrations r ON r.id = m.registration_id
         LEFT JOIN messaging_contacts c ON c.id = r.messaging_contact_id
        WHERE m.direction = 'OUT'
          AND (m.status IN ('FAILED', 'WAITING_CONTACT', 'WAITING_WINDOW')
               OR (m.status = 'QUEUED' AND m.attempts > 0))
        ORDER BY m.created_at DESC, m.id DESC LIMIT 200`,
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
}

export const postgresAdminMessageRepository = new PostgresAdminMessageRepository();
