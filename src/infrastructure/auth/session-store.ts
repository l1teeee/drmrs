import { createHash, randomBytes } from "node:crypto";

import type {
  AdminAuthAudit,
  AdminAuthRepository,
  AdminForSignIn,
  AdminSession,
} from "@/application/auth/admin-auth-repository";

import { getPool } from "../db/client";
import { inTransaction } from "../db/transaction";

interface AdminSignInRow {
  id: string;
  password_hash: string;
  is_active: boolean;
  locked_until_passed: boolean;
}

interface SessionRow {
  session_id: string;
  admin_id: string;
  display_name: string;
  email: string;
  role: AdminSession["role"];
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export class PostgresAdminAuthRepository implements AdminAuthRepository {
  async findAdminForSignIn(emailNormalized: string): Promise<AdminForSignIn | null> {
    const result = await getPool().query<AdminSignInRow>(
      `SELECT id, password_hash, is_active,
              (locked_until IS NULL OR locked_until <= now()) AS locked_until_passed
         FROM admin_users
        WHERE email_normalized = $1`,
      [emailNormalized],
    );
    const row = result.rows[0];
    return row ? {
      id: row.id,
      passwordHash: row.password_hash,
      isActive: row.is_active,
      lockedUntilPassed: row.locked_until_passed,
    } : null;
  }

  async recordFailedSignIn(adminId: string): Promise<{ locked: boolean }> {
    const result = await getPool().query<{ locked: boolean }>(
      `UPDATE admin_users
          SET failed_sign_in_count = CASE
                WHEN failed_sign_in_count + 1 >= 5 THEN 0
                ELSE failed_sign_in_count + 1
              END,
              locked_until = CASE
                WHEN failed_sign_in_count + 1 >= 5 THEN now() + interval '15 minutes'
                ELSE locked_until
              END,
              updated_at = now()
        WHERE id = $1
        RETURNING (locked_until > now()) IS TRUE AS locked`,
      [adminId],
    );
    return result.rows[0]!;
  }

  async createSession(adminId: string, tokenHash: string): Promise<void> {
    await inTransaction(
      getPool(),
      ["SET LOCAL lock_timeout = '3s'", "SET LOCAL statement_timeout = '5s'"],
      async (client) => {
        await client.query(
          `UPDATE admin_users
              SET failed_sign_in_count = 0, last_sign_in_at = now(), updated_at = now()
            WHERE id = $1`,
          [adminId],
        );
        await client.query(
          `DELETE FROM admin_sessions
            WHERE admin_user_id = $1
              AND (expires_at <= now() OR last_seen_at <= now() - interval '2 hours')`,
          [adminId],
        );
        await client.query(
          `INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at)
           VALUES ($1, $2, now() + interval '12 hours')`,
          [tokenHash, adminId],
        );
        await client.query(
          `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id)
           VALUES ($1, 'ADMIN_SIGNED_IN', 'admin_user', $2)`,
          [adminId, adminId],
        );
      },
    );
  }

  async findSession(tokenHash: string): Promise<AdminSession | null> {
    const result = await getPool().query<SessionRow>(
      `WITH valid_session AS MATERIALIZED (
         SELECT s.id AS session_id, a.id AS admin_id, a.display_name, a.email, a.role
           FROM admin_sessions s
           JOIN admin_users a ON a.id = s.admin_user_id
          WHERE s.token_hash = $1
            AND s.expires_at > now()
            AND s.last_seen_at > now() - interval '2 hours'
            AND a.is_active = true
       ), refreshed AS (
         UPDATE admin_sessions s
            SET last_seen_at = now()
           FROM valid_session v
          WHERE s.id = v.session_id
            AND s.last_seen_at < now() - interval '5 minutes'
          RETURNING s.id
       )
       SELECT session_id, admin_id, display_name, email, role FROM valid_session`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row ? {
      sessionId: row.session_id,
      adminId: row.admin_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
    } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await getPool().query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
  }

  async recordAudit(
    adminId: string | null,
    action: AdminAuthAudit["action"],
    metadata: AdminAuthAudit["metadata"],
  ): Promise<void> {
    await getPool().query(
      `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'admin_user', $3, $4::jsonb)`,
      [adminId, action, adminId, JSON.stringify(metadata)],
    );
  }
}

export const postgresAdminAuthRepository = new PostgresAdminAuthRepository();
