import type { PoolClient } from "pg";

import type {
  AdminRegistroRow,
  AdminRegistroStore,
  AuditEntry,
  MessageTemplate,
} from "@/application/admin-registros/admin-registro-store";
import type { ListFilters } from "@/contracts/admin-registros";
import type { TemplateKey } from "@/domain/messaging/message-template";
import type { PieceStatus, Size } from "@/domain/registration/registration";

import { getEnv } from "../../config/env";
import { decryptSecret } from "../../crypto/secret-box";
import { getPool } from "../client";
import { inTransaction } from "../transaction";

const transactionSettings = ["SET LOCAL lock_timeout = '3s'", "SET LOCAL statement_timeout = '5s'"];

const registrationColumns = `id, registration_number, full_name, instagram_handle,
  whatsapp_ciphertext, email_ciphertext, size, archive_nominee, source, origin,
  piece_status, link_version, registered_at`;

interface RegistrationRow {
  id: string;
  registration_number: number;
  full_name: string;
  instagram_handle: string;
  whatsapp_ciphertext: string;
  email_ciphertext: string | null;
  size: Size;
  archive_nominee: string | null;
  source: string;
  origin: "WEB" | "IMPORT";
  piece_status: PieceStatus;
  link_version: number;
  registered_at: Date;
}

interface TemplateRow {
  key: TemplateKey;
  body: string;
  updated_at: Date;
}

interface AuditRow {
  id: string;
  occurred_at: Date;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
}

function toAdminRegistro(row: RegistrationRow): AdminRegistroRow {
  const key = getEnv().PII_ENCRYPTION_KEY;
  return {
    id: row.id,
    registrationNumber: row.registration_number,
    fullName: row.full_name,
    instagramHandle: row.instagram_handle,
    whatsappDigits: decryptSecret(row.whatsapp_ciphertext, key, "registrations.whatsapp"),
    email: row.email_ciphertext === null
      ? null
      : decryptSecret(row.email_ciphertext, key, "registrations.email"),
    size: row.size,
    archiveNominee: row.archive_nominee,
    source: row.source,
    origin: row.origin,
    pieceStatus: row.piece_status,
    linkVersion: row.link_version,
    registeredAt: row.registered_at,
  };
}

async function insertAudit(
  client: PoolClient,
  adminId: string,
  action: string,
  entityType: "registration" | "message_template",
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [adminId, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

export class PostgresAdminRegistroRepository implements AdminRegistroStore {
  async list(filters: ListFilters): Promise<AdminRegistroRow[]> {
    const query = filters.q ? `%${filters.q.replace(/[\\%_]/g, "\\$&")}%` : null;
    const result = await getPool().query<RegistrationRow>(
      `SELECT ${registrationColumns} FROM registrations
        WHERE ($1::text IS NULL OR full_name ILIKE $1 ESCAPE '\\'
                               OR instagram_handle ILIKE $1 ESCAPE '\\')
          AND ($2::text IS NULL OR piece_status = $2)
          AND ($3::text IS NULL OR size = $3)
        ORDER BY registration_number`,
      [query, filters.estado ?? null, filters.talla ?? null],
    );
    return result.rows.map(toAdminRegistro);
  }

  async findById(id: string): Promise<AdminRegistroRow | null> {
    const result = await getPool().query<RegistrationRow>(
      `SELECT ${registrationColumns} FROM registrations WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toAdminRegistro(row) : null;
  }

  async changeStatus(
    adminId: string,
    id: string,
    expected: PieceStatus,
    next: PieceStatus,
  ): Promise<"changed" | "conflict" | "not_found"> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query(
        `UPDATE registrations SET piece_status = $3, updated_at = now()
          WHERE id = $1 AND piece_status = $2 RETURNING id`,
        [id, expected, next],
      );
      if (result.rows.length === 0) {
        const existing = await client.query("SELECT 1 FROM registrations WHERE id = $1", [id]);
        return existing.rows.length > 0 ? "conflict" : "not_found";
      }
      await insertAudit(client, adminId, "PIECE_STATUS_CHANGED", "registration", id, {
        from: expected,
        to: next,
      });
      return "changed";
    });
  }

  async regenerateLink(adminId: string, id: string): Promise<{ linkVersion: number } | null> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query<{ link_version: number }>(
        `UPDATE registrations SET link_version = link_version + 1, updated_at = now()
          WHERE id = $1 RETURNING link_version`,
        [id],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      await insertAudit(client, adminId, "EXPEDIENTE_LINK_REGENERATED", "registration", id);
      return { linkVersion: row.link_version };
    });
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    const result = await getPool().query<TemplateRow>(
      "SELECT key, body, updated_at FROM message_templates ORDER BY key",
    );
    return result.rows.map((row) => ({ key: row.key, body: row.body, updatedAt: row.updated_at }));
  }

  async updateTemplate(adminId: string, key: TemplateKey, body: string): Promise<void> {
    await inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query(
        `UPDATE message_templates SET body = $2, updated_at = now(), updated_by = $3
          WHERE key = $1`,
        [key, body, adminId],
      );
      if (result.rowCount === 0) {
        throw new Error("Message template not found");
      }
      await insertAudit(client, adminId, "MESSAGE_TEMPLATE_UPDATED", "message_template", key);
    });
  }

  async recordExport(adminId: string, count: number): Promise<void> {
    await inTransaction(getPool(), transactionSettings, async (client) => {
      await insertAudit(client, adminId, "REGISTRATIONS_EXPORTED", "registration", null, { count });
    });
  }

  async listAudit(before: number | null, limit: number): Promise<AuditEntry[]> {
    const result = await getPool().query<AuditRow>(
      `SELECT a.id, a.occurred_at, u.display_name AS actor_name, a.action,
              a.entity_type, a.entity_id, a.metadata
         FROM audit_logs a
         LEFT JOIN admin_users u ON u.id = a.actor_admin_id
        WHERE ($1::bigint IS NULL OR a.id < $1)
        ORDER BY a.id DESC LIMIT $2`,
      [before, limit],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      occurredAt: row.occurred_at,
      actorName: row.actor_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
    }));
  }
}

export const postgresAdminRegistroRepository = new PostgresAdminRegistroRepository();
