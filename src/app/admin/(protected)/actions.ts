"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { findDropById } from "@/application/drops/drops";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { clearSessionCookie, sessionCookieName } from "@/infrastructure/auth/cookie";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { hashSessionToken, postgresAdminAuthRepository } from "@/infrastructure/auth/session-store";
import { getEnv, isProtectedEnvironment } from "@/infrastructure/config/env";
import { dropsDependencies } from "@/infrastructure/drops/drops-runtime";

export async function seleccionarDropAction(value: string): Promise<{ ok: true } | { ok: false }> {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) return { ok: false };
  if (value !== "todos") {
    if (!z.uuid().safeParse(value).success || !(await findDropById(value, dropsDependencies()))) {
      return { ok: false };
    }
  }
  const store = await cookies();
  store.set({ name: "drmr_admin_drop", value, httpOnly: true, sameSite: "lax", path: "/admin", maxAge: 31536000, secure: isProtectedEnvironment({ APP_ENV: getEnv().APP_ENV }) });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) {
    redirect(adminHref("/login"));
  }

  const environment = getEnv();
  const store = await cookies();
  const token = store.get(sessionCookieName(environment.APP_ENV))!.value;
  await postgresAdminAuthRepository.deleteSession(hashSessionToken(token));
  await postgresAdminAuthRepository.recordAudit(authorization.admin.adminId, "ADMIN_SIGNED_OUT", {});
  clearSessionCookie(store, environment.APP_ENV);
  revalidatePath("/admin", "layout");
  redirect(adminHref("/login"));
}
