import { timingSafeEqual } from "node:crypto";

import { after } from "next/server";

import { getEnv } from "@/infrastructure/config/env";
import { postgresInstagramConnectionRepository } from "@/infrastructure/db/repositories/postgres-instagram-connection-repository";
import { readLimitedBody } from "@/infrastructure/http/read-limited-body";
import { parseInstagramWebhook } from "@/infrastructure/instagram/instagram-webhook-parser";
import { isValidSignature } from "@/infrastructure/instagram/webhook-signature";
import { ingestConfiguredInstagramEvents } from "@/infrastructure/messaging/ingest-instagram-events";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";

const MAX_BODY_BYTES = 1024 * 1024;
const SIGNATURE_HEADER_FORMAT = /^sha256=[0-9a-f]{64}$/;

function safeEqual(supplied: string, expected: string): boolean {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function GET(request: Request): Promise<Response> {
  const environment = getEnv();
  if (environment.MESSAGING_MODE === "disabled") return new Response(null, { status: 404 });
  const params = new URL(request.url).searchParams;
  const expected = environment.META_WEBHOOK_VERIFY_TOKEN;
  if (params.get("hub.mode") !== "subscribe" || !expected || !safeEqual(params.get("hub.verify_token") ?? "", expected)) {
    return new Response(null, { status: 403 });
  }
  return new Response(params.get("hub.challenge") ?? "", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const environment = getEnv();
  if (environment.MESSAGING_MODE === "disabled") return new Response(null, { status: 404 });
  if (!SIGNATURE_HEADER_FORMAT.test(request.headers.get("x-hub-signature-256") ?? "")) {
    return new Response(null, { status: 401 });
  }
  const body = await readLimitedBody(request, MAX_BODY_BYTES);
  if (!body.ok) return new Response(null, { status: 413 });
  if (!environment.META_APP_SECRET || !isValidSignature(
    body.bytes, request.headers.get("x-hub-signature-256"), environment.META_APP_SECRET,
  )) {
    return new Response(null, { status: 401 });
  }
  const connection = await postgresInstagramConnectionRepository.find();
  if (!connection) {
    log("warn", "instagram_webhook_not_connected");
    return new Response("EVENT_RECEIVED");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    log("warn", "instagram_webhook_invalid_json", { code: "INVALID_JSON" });
    return new Response("EVENT_RECEIVED");
  }
  const parsed = parseInstagramWebhook(payload, connection.accountId);
  const result = await ingestConfiguredInstagramEvents(parsed.events, {
    ownAccountId: connection.accountId,
    deadline: Date.now() + 25_000,
  });
  after(async () => {
    try {
      await result.after();
    } catch (error) {
      log("error", "instagram_webhook_followup_failed", { code: safeErrorCode(error) });
    }
  });
  return new Response("EVENT_RECEIVED");
}
