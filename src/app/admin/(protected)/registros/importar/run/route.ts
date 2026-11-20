import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runImport } from "@/application/registration-import/import-registrations";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { postgresRegistrationImportRepository } from "@/infrastructure/db/repositories/postgres-registration-import-repository";
import { retryableDatabaseErrorCode } from "@/infrastructure/db/retryable-database-error";
import { readLimitedBody } from "@/infrastructure/http/read-limited-body";
import { isSameOriginRequest } from "@/infrastructure/http/same-origin-request";
import { log } from "@/infrastructure/observability/logger";
import { consume, RATE_LIMITS } from "@/infrastructure/rate-limit/postgres-rate-limiter";

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isSameOriginRequest(request)) {
      return jsonResponse(403, { ok: false, error: "origen" });
    }
    const authorization = await requireAdmin("action");
    if (!authorization.ok) {
      return jsonResponse(401, { ok: false, error: "sesión" });
    }
    const drop = z.uuid().safeParse(new URL(request.url).searchParams.get("drop"));
    if (!drop.success) {
      return jsonResponse(400, { ok: false, error: "datos" });
    }
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("text/csv") && !contentType.startsWith("text/plain")) {
      return jsonResponse(415, { ok: false, error: "datos" });
    }
    const body = await readLimitedBody(request, 1_048_576);
    if (!body.ok) {
      return jsonResponse(413, { ok: false, error: "datos" });
    }

    const result = await runImport(body.text, authorization.admin.adminId, {
      store: postgresRegistrationImportRepository,
      checkPreview: (subject) => consume({ ...RATE_LIMITS.adminImportPreview, subject }),
      checkRun: (subject) => consume({ ...RATE_LIMITS.adminImportRun, subject }),
    }, drop.data);
    if (!result.ok) {
      return jsonResponse(result.reason === "rate_limited" ? 429 : 400, {
        ok: false, error: result.reason,
      });
    }
    revalidatePath("/admin/registros");
    return jsonResponse(200, result);
  } catch (error) {
    if (retryableDatabaseErrorCode(error) !== null) {
      return jsonResponse(503, { ok: false, error: "servidor" });
    }
    const errorName = error instanceof Error ? error.name : "UnknownError";
    log("error", "registration_import_failed", { errorName });
    return jsonResponse(500, { ok: false, error: "servidor" });
  }
}
