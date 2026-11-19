import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AdminSession } from "@/application/auth/admin-auth-repository";

import { adminHref } from "../admin/admin-path";
import { getEnv } from "../config/env";
import { sessionCookieName } from "./cookie";
import { hashSessionToken, postgresAdminAuthRepository } from "./session-store";

export type AdminAuthorizationResult = { ok: false } | { ok: true; admin: AdminSession };

export async function requireAdmin(mode: "page"): Promise<AdminSession>;
export async function requireAdmin(mode: "action"): Promise<AdminAuthorizationResult>;
export async function requireAdmin(mode: "page" | "action"): Promise<AdminSession | AdminAuthorizationResult> {
  const store = await cookies();
  const token = store.get(sessionCookieName(getEnv().APP_ENV))?.value;
  const admin = token ? await postgresAdminAuthRepository.findSession(hashSessionToken(token)) : null;
  if (!admin) {
    if (mode === "page") {
      redirect(adminHref("/login"));
    }
    return { ok: false };
  }

  return mode === "page" ? admin : { ok: true, admin };
}
