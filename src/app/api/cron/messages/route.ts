import { timingSafeEqual } from "node:crypto";

import { connection } from "next/server";

import { getEnv } from "@/infrastructure/config/env";
import { drainMessageOutbox } from "@/infrastructure/messaging/drain-message-outbox";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  await connection();
  const environment = getEnv();
  const headers = { "Cache-Control": "no-store" };
  if (!environment.CRON_SECRET || environment.MESSAGING_MODE !== "instagram") {
    return new Response(null, { status: 404, headers });
  }
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${environment.CRON_SECRET}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return new Response(null, { status: 401, headers });
  }
  const summary = await drainMessageOutbox({ limit: 200, timeBudgetMs: 50_000 });
  return Response.json(summary, { headers });
}
