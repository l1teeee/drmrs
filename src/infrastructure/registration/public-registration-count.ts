import { cacheLife, cacheTag } from "next/cache";

import { getPool } from "../db/client";

// Callers must call `await connection()` before this so it never runs at build time.
export async function getPublicRegistrationCount(dropId: string): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag("drops");

  const result = await getPool().query<{ total: number }>(
    "SELECT count(*)::int AS total FROM registrations WHERE drop_id = $1",
    [dropId],
  );
  return result.rows[0]!.total;
}
