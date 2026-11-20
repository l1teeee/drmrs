import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";

import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { getEnv, isProtectedEnvironment } from "@/infrastructure/config/env";
import { completeConfiguredInstagramConnection } from "@/infrastructure/instagram/instagram-connection-runtime";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";

function responseFor(notice: "conectado" | "error" | null): Response {
  const environment = getEnv();
  const response = notice === null
    ? new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } })
    : NextResponse.redirect(new URL(adminHref(`/mensajes?instagram=${notice}`), environment.APP_BASE_URL), {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  response.cookies.set("drmr_ig_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/instagram/callback",
    maxAge: 0,
    secure: isProtectedEnvironment(environment),
  });
  return response;
}

export async function GET(request: Request): Promise<Response> {
  await connection();
  if (getEnv().MESSAGING_MODE !== "instagram") return responseFor(null);
  const authorization = await requireAdmin("action");
  if (!authorization.ok || authorization.admin.role !== "OWNER") return responseFor(null);
  const cookie = (await cookies()).get("drmr_ig_oauth_state")?.value;
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  if (!state || !cookie) {
    log("warn", "instagram_connect_failed", { code: "STATE_MISSING" });
    return responseFor("error");
  }
  const supplied = Buffer.from(state);
  const expected = Buffer.from(cookie);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    log("warn", "instagram_connect_failed", { code: "STATE_MISMATCH" });
    return responseFor("error");
  }
  if (params.has("error")) {
    const errorReason = params.get("error_reason");
    const reason = errorReason !== null && /^[a-z_]{1,40}$/.test(errorReason) ? errorReason : "unknown";
    log("warn", "instagram_connect_failed", { code: "OAUTH_ERROR", reason });
    return responseFor("error");
  }
  const code = params.get("code");
  if (!code) {
    log("warn", "instagram_connect_failed", { code: "CODE_MISSING" });
    return responseFor("error");
  }
  try {
    const result = await completeConfiguredInstagramConnection(code, authorization.admin.adminId);
    if (!result.ok) {
      log("warn", "instagram_connect_failed", { code: result.error });
      return responseFor("error");
    }
    log("info", "instagram_connected");
    return responseFor("conectado");
  } catch (error) {
    log("error", "instagram_connect_failed", { code: safeErrorCode(error) });
    return responseFor("error");
  }
}
