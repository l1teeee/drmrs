import { z } from "zod";

import { uploadPiecePhoto } from "@/application/registration/piece-photos";
import { MAX_PIECE_PHOTO_BYTES } from "@/domain/registration/piece-photo";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { postgresPiecePhotoRepository } from "@/infrastructure/db/repositories/postgres-piece-photo-repository";
import { retryableDatabaseErrorCode } from "@/infrastructure/db/retryable-database-error";
import { readLimitedBody } from "@/infrastructure/http/read-limited-body";
import { isSameOriginRequest } from "@/infrastructure/http/same-origin-request";
import { log } from "@/infrastructure/observability/logger";
import { consume, RATE_LIMITS } from "@/infrastructure/rate-limit/postgres-rate-limiter";

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    if (!isSameOriginRequest(request)) {
      return jsonResponse(403, { ok: false, error: "origen" });
    }
    const authorization = await requireAdmin("action");
    if (!authorization.ok) {
      return jsonResponse(401, { ok: false, error: "sesión" });
    }
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) {
      return jsonResponse(404, { ok: false, error: "registro" });
    }
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("image/")) {
      return jsonResponse(415, { ok: false, error: "tipo" });
    }
    const body = await readLimitedBody(request, MAX_PIECE_PHOTO_BYTES);
    if (!body.ok) {
      return jsonResponse(413, { ok: false, error: "tamaño" });
    }

    const result = await uploadPiecePhoto(authorization.admin.adminId, id, body.bytes, {
      photos: postgresPiecePhotoRepository,
      checkAdminAction: (subject) => consume({ ...RATE_LIMITS.adminAction, subject }),
    });
    switch (result.kind) {
      case "rate_limited":
        return jsonResponse(429, { ok: false, error: "límite" });
      case "too_large":
        return jsonResponse(413, { ok: false, error: "tamaño" });
      case "invalid_type":
        return jsonResponse(415, { ok: false, error: "tipo" });
      case "not_found":
        return jsonResponse(404, { ok: false, error: "registro" });
      case "limit":
        return jsonResponse(409, { ok: false, error: "máximo" });
      case "stage":
        return jsonResponse(409, { ok: false, error: "etapa" });
      case "added":
        return jsonResponse(201, { ok: true, id: result.id });
    }
  } catch (error) {
    if (retryableDatabaseErrorCode(error) !== null) {
      return jsonResponse(503, { ok: false, error: "servidor" });
    }
    const errorName = error instanceof Error ? error.name : "UnknownError";
    log("error", "piece_photo_upload_failed", { errorName });
    return jsonResponse(500, { ok: false, error: "servidor" });
  }
}
