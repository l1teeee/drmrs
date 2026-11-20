import { z } from "zod";

import { getExpedientePhoto } from "@/application/registration/piece-photos";
import { expedienteCodes } from "@/infrastructure/crypto/expediente-code";
import { postgresPiecePhotoRepository } from "@/infrastructure/db/repositories/postgres-piece-photo-repository";
import { postgresRegistrationRepository } from "@/infrastructure/db/repositories/postgres-registration-repository";
import { retryableDatabaseErrorCode } from "@/infrastructure/db/retryable-database-error";
import { getRateLimitSubject, getRawClientIp } from "@/infrastructure/http/client-ip";
import { log } from "@/infrastructure/observability/logger";
import { consume, RATE_LIMITS } from "@/infrastructure/rate-limit/postgres-rate-limiter";

const paramsSchema = z.object({
  slug: z.string().min(1).max(60),
  fotoId: z.uuid(),
});

function notFoundResponse(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; fotoId: string }> },
): Promise<Response> {
  try {
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return notFoundResponse();
    }
    const limit = await consume({
      ...RATE_LIMITS.expedientePhotoIp,
      subject: getRateLimitSubject(getRawClientIp(request.headers)),
    });
    if (!limit.allowed) {
      return new Response(null, { status: 429, headers: { "Cache-Control": "no-store" } });
    }
    const photo = await getExpedientePhoto(parsed.data.slug, parsed.data.fotoId, {
      store: postgresRegistrationRepository,
      codes: expedienteCodes,
      photos: postgresPiecePhotoRepository,
    });
    if (!photo) {
      return notFoundResponse();
    }
    return new Response(Buffer.from(photo.data), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (retryableDatabaseErrorCode(error) !== null) {
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const errorName = error instanceof Error ? error.name : "UnknownError";
    log("error", "expediente_photo_failed", { errorName });
    return new Response(null, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
