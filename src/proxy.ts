import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/admin/login";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const nonce = Buffer.from(randomUUID()).toString("base64");
  const unsafeEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const contentSecurityPolicy =
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${unsafeEval}; ` +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; " +
    "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const hasSession = request.cookies.has("__Host-drmr_admin") || request.cookies.has("drmr_admin");
  let response: NextResponse;
  if (pathname !== LOGIN_PATH && !hasSession) {
    response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
