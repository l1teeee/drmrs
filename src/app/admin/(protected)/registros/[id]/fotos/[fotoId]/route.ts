import { z } from "zod";

import { deletePiecePhoto } from "@/application/registration/piece-photos";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { postgresPiecePhotoRepository } from "@/infrastructure/db/repositories/postgres-piece-photo-repository";
import { retryableDatabaseErrorCode } from "@/infrastructure/db/retryable-database-error";
import { isSameOriginRequest } from "@/infrastructure/http/same-origin-request";
import { log } from "@/infrastructure/observability/logger";
import { consume, RATE_LIMITS } from "@/infrastructure/rate-limit/postgres-rate-limiter";

type RouteContext = { params: Promise<{ id: string; fotoId: string }> };

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function failureResponse(error: unknown, event: string): Response {
  if (retryableDatabaseErrorCode(error) !== null) {
    return jsonResponse(503, { ok: false, error: "servidor" });
  }
  const errorName = error instanceof Error ? error.name : "UnknownError";
  log("error", event, { errorName });
  return jsonResponse(500, { ok: false, error: "servidor" });
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const authorization = await requireAdmin("action");
    if (!authorization.ok) {
      return jsonResponse(401, { ok: false, error: "sesión" });
    }
    const { id, fotoId } = await params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(fotoId).success) {
      return jsonResponse(404, { ok: false, error: "foto" });
    }
    const photo = await postgresPiecePhotoRepository.get(id, fotoId);
    if (!photo) {
      return jsonResponse(404, { ok: false, error: "foto" });
    }
    return new Response(Buffer.from(photo.data), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failureResponse(error, "piece_photo_read_failed");
  }
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    if (!isSameOriginRequest(request)) {
      return jsonResponse(403, { ok: false, error: "origen" });
    }
    const authorization = await requireAdmin("action");
    if (!authorization.ok) {
      return jsonResponse(401, { ok: false, error: "sesión" });
    }
    const { id, fotoId } = await params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(fotoId).success) {
      return jsonResponse(404, { ok: false, error: "foto" });
    }
    const result = await deletePiecePhoto(authorization.admin.adminId, id, fotoId, {
      photos: postgresPiecePhotoRepository,
      checkAdminAction: (subject) => consume({ ...RATE_LIMITS.adminAction, subject }),
    });
    if (result.kind === "rate_limited") {
      return jsonResponse(429, { ok: false, error: "límite" });
    }
    if (result.kind === "not_found") {
      return jsonResponse(404, { ok: false, error: "foto" });
    }
    return jsonResponse(200, { ok: true });
  } catch (error) {
    return failureResponse(error, "piece_photo_delete_failed");
  }
}
