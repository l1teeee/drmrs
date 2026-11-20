import type { PoolClient } from "pg";

import type { PiecePhotoStore } from "@/application/registration/piece-photos";
import {
  MAX_PIECE_PHOTOS,
  photosEnabledFor,
  type PiecePhotoContentType,
} from "@/domain/registration/piece-photo";
import type { PieceStatus } from "@/domain/registration/registration";

import { getPool } from "../client";
import { inTransaction } from "../transaction";

const transactionSettings = [
  "SET LOCAL lock_timeout = '3s'",
  "SET LOCAL statement_timeout = '5s'",
] as const;

async function insertAudit(
  client: PoolClient,
  adminId: string,
  action: "PIECE_PHOTO_ADDED" | "PIECE_PHOTO_DELETED",
  registrationId: string,
  photoId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'registration', $3, $4::jsonb)`,
    [adminId, action, registrationId, JSON.stringify({ photoId })],
  );
}

export class PostgresPiecePhotoRepository implements PiecePhotoStore {
  add(input: Parameters<PiecePhotoStore["add"]>[0]): ReturnType<PiecePhotoStore["add"]> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const registration = await client.query<{ piece_status: PieceStatus }>(
        "SELECT piece_status FROM registrations WHERE id = $1 FOR UPDATE",
        [input.registrationId],
      );
      const row = registration.rows[0];
      if (!row) return { ok: false, error: "NOT_FOUND" };
      if (!photosEnabledFor(row.piece_status)) return { ok: false, error: "STAGE" };

      const count = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM piece_photos WHERE registration_id = $1",
        [input.registrationId],
      );
      if (count.rows[0].n >= MAX_PIECE_PHOTOS) return { ok: false, error: "LIMIT" };

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO piece_photos (registration_id, content_type, byte_size, data, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          input.registrationId,
          input.contentType,
          input.data.byteLength,
          Buffer.from(input.data),
          input.adminId,
        ],
      );
      const id = inserted.rows[0].id;
      await insertAudit(client, input.adminId, "PIECE_PHOTO_ADDED", input.registrationId, id);
      return { ok: true, id };
    });
  }

  async listIds(registrationId: string): Promise<string[]> {
    const result = await getPool().query<{ id: string }>(
      "SELECT id FROM piece_photos WHERE registration_id = $1 ORDER BY created_at, id",
      [registrationId],
    );
    return result.rows.map((row) => row.id);
  }

  async get(
    registrationId: string,
    photoId: string,
  ): Promise<{ contentType: PiecePhotoContentType; data: Uint8Array } | null> {
    const result = await getPool().query<{ content_type: PiecePhotoContentType; data: Buffer }>(
      "SELECT content_type, data FROM piece_photos WHERE id = $1 AND registration_id = $2",
      [photoId, registrationId],
    );
    const row = result.rows[0];
    return row ? { contentType: row.content_type, data: row.data } : null;
  }

  delete(adminId: string, registrationId: string, photoId: string): Promise<boolean> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query(
        "DELETE FROM piece_photos WHERE id = $1 AND registration_id = $2",
        [photoId, registrationId],
      );
      if (result.rowCount !== 1) return false;
      await insertAudit(client, adminId, "PIECE_PHOTO_DELETED", registrationId, photoId);
      return true;
    });
  }
}

export const postgresPiecePhotoRepository = new PostgresPiecePhotoRepository();
