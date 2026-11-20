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

const registrationColumns = `r.id, r.registration_number, r.full_name, r.instagram_handle,
  r.whatsapp_ciphertext, r.email_ciphertext, r.size, r.archive_nominee, r.source, r.origin,
  r.piece_status, r.link_version, r.registered_at,
  d.id AS drop_id, d.number AS drop_number, d.name AS drop_name,
  d.registered_opens_at AS drop_registered_opens_at, d.public_opens_at AS drop_public_opens_at`;

interface RegistrationRow {
  drop_id: string;
  drop_number: number;
  drop_name: string;
  drop_registered_opens_at: Date;
  drop_public_opens_at: Date;
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
  registro_id: string | null;
  registro_numero: number | null;
  registro_drop_number: number | null;
  registro_nombre: string | null;
  registro_instagram: string | null;
}

function toAdminRegistro(row: RegistrationRow): AdminRegistroRow {
  const key = getEnv().PII_ENCRYPTION_KEY;
  return {
    dropId: row.drop_id,
    dropNumber: row.drop_number,
    dropName: row.drop_name,
    dropRegisteredOpensAt: row.drop_registered_opens_at,
    dropPublicOpensAt: row.drop_public_opens_at,
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
      `SELECT ${registrationColumns} FROM registrations r JOIN drops d ON d.id = r.drop_id
        WHERE ($1::text IS NULL OR r.full_name ILIKE $1 ESCAPE '\\'
                               OR r.instagram_handle ILIKE $1 ESCAPE '\\')
          AND ($2::text IS NULL OR r.piece_status = $2)
          AND ($3::text IS NULL OR r.size = $3)
          AND ($4::uuid IS NULL OR r.drop_id = $4)
        ORDER BY d.number, r.registration_number`,
      [query, filters.estado ?? null, filters.talla ?? null, filters.dropId ?? null],
    );
    return result.rows.map(toAdminRegistro);
  }

  async findById(id: string): Promise<AdminRegistroRow | null> {
    const result = await getPool().query<RegistrationRow>(
      `SELECT ${registrationColumns} FROM registrations r JOIN drops d ON d.id = r.drop_id WHERE r.id = $1`,
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

  async recordExport(adminId: string, count: number, dropNumber: number | null): Promise<void> {
    await inTransaction(getPool(), transactionSettings, async (client) => {
      await insertAudit(client, adminId, "REGISTRATIONS_EXPORTED", "registration", null, { count, dropNumber });
    });
  }

  async countAudit(): Promise<number> {
    const result = await getPool().query<{ total: number }>(
      "SELECT count(*)::int AS total FROM audit_logs",
    );
    return result.rows[0]!.total;
  }

  async listAudit(offset: number, limit: number): Promise<AuditEntry[]> {
    const result = await getPool().query<AuditRow>(
      `SELECT a.id, a.occurred_at, u.display_name AS actor_name, a.action,
              a.entity_type, a.entity_id, a.metadata,
              r.id AS registro_id, r.registration_number AS registro_numero,
              d.number AS registro_drop_number,
              r.full_name AS registro_nombre, r.instagram_handle AS registro_instagram
         FROM audit_logs a
         LEFT JOIN admin_users u ON u.id = a.actor_admin_id
         LEFT JOIN registrations r ON a.entity_type = 'registration' AND r.id::text = a.entity_id
         LEFT JOIN drops d ON d.id = r.drop_id
        ORDER BY a.id DESC LIMIT $2 OFFSET $1`,
      [offset, limit],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      occurredAt: row.occurred_at,
      actorName: row.actor_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      registro:
        row.registro_id === null
          ? null
          : {
              id: row.registro_id,
              numero: row.registro_numero!,
              dropNumber: row.registro_drop_number!,
              nombre: row.registro_nombre!,
              instagram: row.registro_instagram!,
            },
    }));
  }
}

export const postgresAdminRegistroRepository = new PostgresAdminRegistroRepository();
