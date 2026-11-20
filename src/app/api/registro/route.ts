import { randomUUID } from "node:crypto";

import { submitRegistration } from "@/application/registration/submit-registration";
import { retryableDatabaseErrorCode } from "@/infrastructure/db/retryable-database-error";
import { getRateLimitSubject, getRawClientIp } from "@/infrastructure/http/client-ip";
import { readLimitedBody } from "@/infrastructure/http/read-limited-body";
import { isSameOriginRequest } from "@/infrastructure/http/same-origin-request";
import { log } from "@/infrastructure/observability/logger";
import { registrationDependencies } from "@/infrastructure/registration/registration-runtime";

const MAXIMUM_BODY_BYTES = 16 * 1024;

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  retryAfterSeconds?: number,
): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(retryAfterSeconds));
  }
  return Response.json(body, { status, headers });
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-vercel-id") ?? randomUUID();

  try {
    if (!isSameOriginRequest(request)) {
      return jsonResponse(403, { ok: false, error: "origen" });
    }

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return jsonResponse(415, { ok: false, error: "datos" });
    }

    const bodyRead = await readLimitedBody(request, MAXIMUM_BODY_BYTES);
    if (!bodyRead.ok) {
      return jsonResponse(413, { ok: false, error: "datos" });
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyRead.text);
    } catch {
      return jsonResponse(400, { ok: false, error: "datos" });
    }

    const remoteIp = getRawClientIp(request.headers);
    const result = await submitRegistration(
      body,
      { remoteIp, rateLimitSubject: getRateLimitSubject(remoteIp) },
      registrationDependencies(),
    );

    switch (result.kind) {
      case "registered":
        return jsonResponse(200, {
          ok: true,
          numero: result.registrationNumber,
          existente: false,
          expediente: result.expedientePath,
          ...(result.instagramLink !== null ? { instagram: result.instagramLink } : {}),
          ...(result.linkCode !== null ? { codigo: result.linkCode } : {}),
        });
      case "existing":
        if (result.registrationNumber === null) {
          return jsonResponse(200, {
            ok: true,
            existente: true,
            ...(result.instagramLink !== null ? { instagram: result.instagramLink } : {}),
          });
        }
        return jsonResponse(200, {
          ok: true,
          numero: result.registrationNumber,
          existente: true,
          ...(result.expedientePath !== null ? { expediente: result.expedientePath } : {}),
          ...(result.instagramLink !== null ? { instagram: result.instagramLink } : {}),
          ...(result.linkCode !== null ? { codigo: result.linkCode } : {}),
        });
      case "invalid":
        return jsonResponse(400, { ok: false, error: "datos" });
      case "bot_rejected":
        return jsonResponse(403, { ok: false, error: "verificacion" });
      case "rate_limited":
        return jsonResponse(429, { ok: false, error: "limite" }, result.retryAfterSeconds);
      case "instagram_taken":
        return jsonResponse(409, { ok: false, error: "instagram" });
      case "unavailable":
        return jsonResponse(503, { ok: false, error: "servidor" }, 5);
    }
  } catch (error) {
    if (retryableDatabaseErrorCode(error) !== null) {
      return jsonResponse(503, { ok: false, error: "servidor" }, 5);
    }

    const errorName = error instanceof Error ? error.name : "UnknownError";
    log("error", "registration_failed", { requestId, errorName });
    return jsonResponse(500, { ok: false, error: "servidor" });
  }
}
