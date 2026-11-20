import type { PoolClient } from "pg";

import type {
  InstagramConnection,
  InstagramConnectionKind,
  InstagramConnectionRepository,
} from "@/application/messaging/instagram-connection";
import { getEnv } from "@/infrastructure/config/env";
import { decryptSecret, encryptSecret } from "@/infrastructure/crypto/secret-box";

import { getPool } from "../client";
import { inTransaction } from "../transaction";

export const INSTAGRAM_CONNECTION_AUDIT_ID = "3f6b2a10-6c1e-4d7a-9b25-8e0c4f1a7d01";

const TOKEN_CONTEXT = "instagram_connection.access_token";
const transactionSettings = [
  "SET LOCAL lock_timeout = '3s'",
  "SET LOCAL statement_timeout = '5s'",
] as const;

function tokenKey(): Buffer {
  const key = getEnv().INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("INSTAGRAM_TOKEN_ENCRYPTION_KEY is not configured");
  return key;
}

interface ConnectionRow {
  account_id: string;
  username: string;
  access_token_ciphertext: string;
  token_expires_at: Date | null;
  kind: InstagramConnectionKind;
  token_version: number;
  connected_by_admin_id: string | null;
  connected_at: Date;
}

async function insertAudit(
  client: PoolClient,
  adminId: string,
  action: "INSTAGRAM_CONNECTED" | "INSTAGRAM_DISCONNECTED",
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id)
     VALUES ($1, $2, 'instagram_connection', $3)`,
    [adminId, action, INSTAGRAM_CONNECTION_AUDIT_ID],
  );
}

export class PostgresInstagramConnectionRepository implements InstagramConnectionRepository {
  async find(): Promise<InstagramConnection | null> {
    const result = await getPool().query<ConnectionRow>(
      `SELECT account_id, username, access_token_ciphertext, token_expires_at, kind, token_version,
              connected_by_admin_id, connected_at
         FROM instagram_connection WHERE id = 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      accountId: row.account_id,
      username: row.username,
      accessToken: decryptSecret(row.access_token_ciphertext, tokenKey(), TOKEN_CONTEXT),
      tokenExpiresAt: row.token_expires_at,
      kind: row.kind,
      tokenVersion: row.token_version,
      connectedByAdminId: row.connected_by_admin_id,
      connectedAt: row.connected_at,
    };
  }

  async findTokenExpiry(): Promise<{ expiresAt: Date | null } | null> {
    const result = await getPool().query<{ token_expires_at: Date | null }>(
      "SELECT token_expires_at FROM instagram_connection WHERE id = 1",
    );
    const row = result.rows[0];
    return row ? { expiresAt: row.token_expires_at } : null;
  }

  async save(input: Parameters<InstagramConnectionRepository["save"]>[0]): Promise<void> {
    const ciphertext = encryptSecret(input.accessToken, tokenKey(), TOKEN_CONTEXT);
    await inTransaction(getPool(), transactionSettings, async (client) => {
      await client.query(
        `INSERT INTO instagram_connection
           (id, account_id, username, access_token_ciphertext, token_expires_at, kind, connected_by_admin_id)
         VALUES (1, $1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           account_id = EXCLUDED.account_id, username = EXCLUDED.username,
           access_token_ciphertext = EXCLUDED.access_token_ciphertext,
           token_expires_at = EXCLUDED.token_expires_at,
           kind = EXCLUDED.kind,
           connected_by_admin_id = EXCLUDED.connected_by_admin_id,
           token_version = instagram_connection.token_version + 1,
           connected_at = now()`,
        [input.accountId, input.username, ciphertext, input.tokenExpiresAt, input.kind, input.adminId],
      );
      await insertAudit(client, input.adminId, "INSTAGRAM_CONNECTED");
    });
  }

  async replaceToken(input: Parameters<InstagramConnectionRepository["replaceToken"]>[0]): Promise<boolean> {
    const ciphertext = encryptSecret(input.accessToken, tokenKey(), TOKEN_CONTEXT);
    const result = await getPool().query(
      `UPDATE instagram_connection
          SET access_token_ciphertext = $1, token_expires_at = $2, token_version = token_version + 1
        WHERE id = 1 AND token_version = $3 AND kind = 'INSTAGRAM_LOGIN'`,
      [ciphertext, input.tokenExpiresAt, input.expectedVersion],
    );
    return result.rowCount === 1;
  }

  delete(adminId: string): Promise<boolean> {
    return inTransaction(getPool(), transactionSettings, async (client) => {
      const result = await client.query("DELETE FROM instagram_connection WHERE id = 1");
      if (result.rowCount !== 1) return false;
      await insertAudit(client, adminId, "INSTAGRAM_DISCONNECTED");
      return true;
    });
  }
}

export const postgresInstagramConnectionRepository = new PostgresInstagramConnectionRepository();
