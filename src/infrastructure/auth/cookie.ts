import { isProtectedEnvironment, type ServerEnv } from "../config/env";

type AppEnvironment = ServerEnv["APP_ENV"];

export interface SessionCookieStore {
  set(options: {
    name: string;
    value: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    expires?: Date;
    maxAge?: number;
  }): void;
}

export function sessionCookieName(appEnvironment: AppEnvironment): string {
  return isProtectedEnvironment({ APP_ENV: appEnvironment }) ? "__Host-drmr_admin" : "drmr_admin";
}

export function sessionCookieOptions(appEnvironment: AppEnvironment) {
  return {
    httpOnly: true,
    secure: isProtectedEnvironment({ APP_ENV: appEnvironment }),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookie(
  store: SessionCookieStore,
  token: string,
  expiresAt: Date,
  appEnvironment: AppEnvironment,
): void {
  store.set({
    name: sessionCookieName(appEnvironment),
    value: token,
    ...sessionCookieOptions(appEnvironment),
    expires: expiresAt,
  });
}

export function clearSessionCookie(
  store: SessionCookieStore,
  appEnvironment: AppEnvironment,
): void {
  store.set({
    name: sessionCookieName(appEnvironment),
    value: "",
    ...sessionCookieOptions(appEnvironment),
    maxAge: 0,
  });
}
