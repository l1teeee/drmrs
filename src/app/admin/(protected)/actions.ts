"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminHref } from "@/infrastructure/admin/admin-path";
import { clearSessionCookie, sessionCookieName } from "@/infrastructure/auth/cookie";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { hashSessionToken, postgresAdminAuthRepository } from "@/infrastructure/auth/session-store";
import { getEnv } from "@/infrastructure/config/env";

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
