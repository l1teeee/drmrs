import { randomBytes } from "node:crypto";

import { connection, NextResponse } from "next/server";

import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { getEnv, isProtectedEnvironment } from "@/infrastructure/config/env";
import { instagramAuthorizationUrl } from "@/infrastructure/instagram/instagram-connection-runtime";

export async function GET(): Promise<Response> {
  await connection();
  const environment = getEnv();
  if (environment.MESSAGING_MODE !== "instagram") {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const authorization = await requireAdmin("action");
  if (!authorization.ok || authorization.admin.role !== "OWNER") {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(instagramAuthorizationUrl(state), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set("drmr_ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/instagram/callback",
    maxAge: 600,
    secure: isProtectedEnvironment(environment),
  });
  return response;
}
