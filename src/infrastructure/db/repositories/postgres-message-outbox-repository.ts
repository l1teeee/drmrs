import type { ClaimedMessage, MessageOutbox } from "@/application/messaging/message-outbox";

import { getPool } from "../client";
import { inTransaction } from "../transaction";

interface ClaimedMessageRow {
  id: string;
  contact_id: string;
  instagram_scoped_id: string;
  body: string;
  parts_sent: number;
  attempts: number;
  last_inbound_at: Date | null;
  locked_until: Date;
}

export class PostgresMessageOutboxRepository implements MessageOutbox {
  async claimDue(limit: number): Promise<ClaimedMessage[]> {
    // Same 23h55m window as src/domain/messaging/messaging-window.ts.
    await getPool().query(
      `UPDATE messages m SET status = 'QUEUED', next_attempt_at = now()
         FROM messaging_contacts c
        WHERE c.id = m.contact_id AND m.direction = 'OUT' AND m.status = 'WAITING_WINDOW'
          AND c.last_inbound_at > now() - interval '23 hours 55 minutes'`,
    );
    // JavaScript dates preserve milliseconds; the fence must round-trip through pg unchanged.
    const result = await getPool().query<ClaimedMessageRow>(
      `WITH candidates AS (
         SELECT m.id FROM messages m
          WHERE m.direction = 'OUT' AND m.status = 'QUEUED'
            AND m.next_attempt_at <= now()
            AND (m.locked_until IS NULL OR m.locked_until < now())
            AND NOT EXISTS (
              SELECT 1 FROM messages older
               WHERE older.contact_id = m.contact_id AND older.direction = 'OUT'
                 AND older.status IN ('QUEUED', 'WAITING_WINDOW')
                 AND (older.created_at, older.id) < (m.created_at, m.id)
            )
          ORDER BY m.next_attempt_at, m.created_at, m.id
          LIMIT $1 FOR UPDATE SKIP LOCKED
       ), claimed AS (
         UPDATE messages m
            SET claims_without_progress = m.claims_without_progress + 1,
                locked_until = CASE WHEN m.claims_without_progress + 1 >= 5 THEN NULL
                  ELSE date_trunc('milliseconds', now()) + interval '2 minutes' END,
                status = CASE WHEN m.claims_without_progress + 1 >= 5 THEN 'FAILED' ELSE 'QUEUED' END,
                last_error = CASE WHEN m.claims_without_progress + 1 >= 5 THEN 'STALLED' ELSE m.last_error END
           FROM candidates c WHERE m.id = c.id
         RETURNING m.*
       )
       SELECT m.id, m.contact_id, c.instagram_scoped_id, m.body, m.parts_sent,
              m.attempts, c.last_inbound_at, m.locked_until
         FROM claimed m JOIN messaging_contacts c ON c.id = m.contact_id
        WHERE m.status = 'QUEUED'
        ORDER BY m.next_attempt_at, m.created_at, m.id`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      contactId: row.contact_id,
      recipientId: row.instagram_scoped_id,
      body: row.body,
      partsSent: row.parts_sent,
      attempts: row.attempts,
      lastInboundAt: row.last_inbound_at,
      lease: row.locked_until,
    }));
  }

  recordPart(id: string, lease: Date, partIndex: number, externalPartId: string): Promise<boolean> {
    return inTransaction(
      getPool(),
      ["SET LOCAL lock_timeout = '3s'", "SET LOCAL statement_timeout = '5s'"],
      async (client) => {
        // Same lock key as the echo handler (Meta message id), so an echo and this write exclude each other.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [externalPartId]);
        await client.query(
          `DELETE FROM messages
            WHERE external_message_id = $1 AND source = 'INSTAGRAM_APP'
              AND direction = 'OUT' AND id <> $2`,
          [externalPartId, id],
        );
        const result = await client.query(
          `UPDATE messages
              SET parts_sent = parts_sent + 1,
                  external_part_ids = array_append(external_part_ids, $4),
                  external_message_id = COALESCE(external_message_id, $4),
                  claims_without_progress = 0
            WHERE id = $1 AND locked_until = $2 AND parts_sent = $3`,
          [id, lease, partIndex, externalPartId],
        );
        return result.rowCount === 1;
      },
    );
  }

  async complete(id: string, lease: Date): Promise<boolean> {
    const result = await getPool().query(
      `UPDATE messages SET status = 'SENT', sent_at = now(), locked_until = NULL,
              last_error = NULL, next_attempt_at = NULL, claims_without_progress = 0
        WHERE id = $1 AND locked_until = $2`,
      [id, lease],
    );
    return result.rowCount === 1;
  }

  async retry(id: string, lease: Date, delaySeconds: number, errorCode: string): Promise<boolean> {
    const result = await getPool().query(
      `UPDATE messages SET attempts = attempts + 1, next_attempt_at = now() + make_interval(secs => $3),
              last_error = $4, locked_until = NULL, claims_without_progress = 0
        WHERE id = $1 AND locked_until = $2`,
      [id, lease, delaySeconds, errorCode],
    );
    return result.rowCount === 1;
  }

  async fail(id: string, lease: Date, errorCode: string): Promise<boolean> {
    const result = await getPool().query(
      `UPDATE messages SET status = 'FAILED', last_error = $3, locked_until = NULL,
              claims_without_progress = 0
        WHERE id = $1 AND locked_until = $2`,
      [id, lease, errorCode],
    );
    return result.rowCount === 1;
  }

  async waitForWindow(id: string, lease: Date): Promise<boolean> {
    const result = await getPool().query(
      `UPDATE messages SET status = 'WAITING_WINDOW', locked_until = NULL, claims_without_progress = 0
        WHERE id = $1 AND locked_until = $2`,
      [id, lease],
    );
    return result.rowCount === 1;
  }
}

export const postgresMessageOutboxRepository = new PostgresMessageOutboxRepository();
