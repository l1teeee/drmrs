import { cacheLife } from "next/cache";

import { getPool } from "../db/client";

// Callers must call `await connection()` before this so it never runs at build time.
export async function getPublicRegistrationCount(): Promise<number> {
  "use cache";
  cacheLife("minutes");

  const result = await getPool().query<{ total: number }>(
    "SELECT count(*)::int AS total FROM registrations",
  );
  return result.rows[0]!.total;
}
