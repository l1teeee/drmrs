import type { PoolClient } from "pg";

import type { DropStore, DropWithCount } from "@/application/drops/drop-store";
import type { Drop, DropStatus } from "@/domain/drop/drop";

import { getPool } from "../client";
import { inTransaction } from "../transaction";

const transactionSettings = ["SET LOCAL lock_timeout = '3s'", "SET LOCAL statement_timeout = '5s'"];
const dropColumns = "d.id, d.number, d.name, d.registered_opens_at, d.public_opens_at, d.pieces, d.status";

interface DropRow {
  id: string;
  number: number;
  name: string;
  registered_opens_at: Date;
  public_opens_at: Date;
  pieces: number;
  status: DropStatus;
}

function toDrop(row: DropRow): Drop {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    registeredOpensAt: row.registered_opens_at,
    publicOpensAt: row.public_opens_at,
    pieces: row.pieces,
    status: row.status,
  };
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "23505" &&
    "constraint" in error && error.constraint === constraint;
}

async function auditDrop(
  client: PoolClient,
  adminId: string,
  action: string,
  id: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'drop', $3, $4::jsonb)`,
    [adminId, action, id, JSON.stringify(metadata)],
  );
}

export const postgresDropRepository: DropStore = {
  async listDrops(): Promise<DropWithCount[]> {
    const result = await getPool().query<DropRow & { registrations: number }>(
      `SELECT ${dropColumns}, count(r.id)::int AS registrations
       FROM drops d LEFT JOIN registrations r ON r.drop_id = d.id
       GROUP BY d.id ORDER BY d.number DESC`,
    );
    return result.rows.map((row) => ({ ...toDrop(row), registrations: row.registrations }));
  },

  async findDropById(id) {
    const result = await getPool().query<DropRow>(`SELECT ${dropColumns} FROM drops d WHERE d.id = $1`, [id]);
    return result.rows[0] ? toDrop(result.rows[0]) : null;
  },

  async findOpenDrop() {
    const result = await getPool().query<DropRow>(`SELECT ${dropColumns} FROM drops d WHERE d.status = 'REGISTRO'`);
    return result.rows[0] ? toDrop(result.rows[0]) : null;
  },

  async createDrop(adminId, input) {
    try {
      return await inTransaction(getPool(), transactionSettings, async (client) => {
        const result = await client.query<{ id: string }>(
          `INSERT INTO drops (number, name, registered_opens_at, public_opens_at, pieces)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [input.number, input.name, input.registeredOpensAt, input.publicOpensAt, input.pieces],
        );
        const id = result.rows[0]!.id;
        await auditDrop(client, adminId, "DROP_CREATED", id, { number: input.number });
        return { kind: "created" as const, id };
      });
    } catch (error) {
      if (isUniqueViolation(error, "drops_number_uq")) return { kind: "number_taken" };
      throw error;
    }
  },

  async updateDrop(adminId, id, input) {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query<{ number: number }>(
        `UPDATE drops SET name = $2, registered_opens_at = $3, public_opens_at = $4,
         pieces = $5, updated_at = now() WHERE id = $1 RETURNING number`,
        [id, input.name, input.registeredOpensAt, input.publicOpensAt, input.pieces],
      );
      const row = result.rows[0];
      if (!row) return "not_found";
      await auditDrop(client, adminId, "DROP_UPDATED", id, { number: row.number });
      return "updated";
    });
  },

  async setDropStatus(adminId, id, expected, next) {
    try {
      return await inTransaction(getPool(), transactionSettings, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('drmr_drop_status'))");
        const result = await client.query<{ status: DropStatus; number: number }>(
          "SELECT status, number FROM drops WHERE id = $1 FOR UPDATE", [id],
        );
        const row = result.rows[0];
        if (!row) return "not_found";
        if (row.status !== expected) return "stale";
        if (next === "REGISTRO") {
          const closed = await client.query<{ id: string; number: number }>(
            `UPDATE drops SET status = 'CERRADO', updated_at = now()
             WHERE status = 'REGISTRO' AND id <> $1 RETURNING id, number`, [id],
          );
          for (const drop of closed.rows) {
            await auditDrop(client, adminId, "DROP_STATUS_CHANGED", drop.id, {
              number: drop.number, from: "REGISTRO", to: "CERRADO",
            });
          }
        }
        await client.query("UPDATE drops SET status = $2, updated_at = now() WHERE id = $1", [id, next]);
        await auditDrop(client, adminId, "DROP_STATUS_CHANGED", id, { number: row.number, from: row.status, to: next });
        return "updated";
      });
    } catch (error) {
      if (isUniqueViolation(error, "drops_single_registro_uq")) return "stale";
      throw error;
    }
  },
};
