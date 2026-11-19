import { cacheLife } from "next/cache";
import { connection } from "next/server";

import { getPool } from "@/infrastructure/db/client";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";

async function databaseIsReachable(): Promise<true> {
  "use cache";
  cacheLife("seconds");

  await getPool().query("SELECT 1");
  return true;
}

export async function GET() {
  await connection();

  try {
    await databaseIsReachable();
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    log("error", "health_db_failed", { code: safeErrorCode(error) });
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
