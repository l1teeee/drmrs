"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/application/auth/sign-in";
import { signInSchema } from "@/contracts/admin-auth";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { setSessionCookie } from "@/infrastructure/auth/cookie";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/infrastructure/auth/password";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import {
  generateSessionToken,
  hashSessionToken,
  postgresAdminAuthRepository,
} from "@/infrastructure/auth/session-store";
import { getEnv } from "@/infrastructure/config/env";
import { getRateLimitSubject, getRawClientIp } from "@/infrastructure/http/client-ip";
import { consume, RATE_LIMITS } from "@/infrastructure/rate-limit/postgres-rate-limiter";

export type LoginState = { error: string };

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const authorization = await requireAdmin("action");
  if (authorization.ok) {
    redirect(adminHref());
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Correo o contraseña incorrectos." };
  }

  const remoteIp = getRawClientIp(await headers());
  const result = await signIn(
    { ...parsed.data, rateLimitSubject: getRateLimitSubject(remoteIp) },
    {
      repository: postgresAdminAuthRepository,
      passwordVerifier: verifyPassword,
      dummyPasswordHash: DUMMY_PASSWORD_HASH,
      generateToken: generateSessionToken,
      hashToken: hashSessionToken,
      checkIp: (subject) => consume({ ...RATE_LIMITS.adminSignInIp, subject }),
      checkEmail: (subject) => consume({ ...RATE_LIMITS.adminSignInEmail, subject }),
    },
  );
  if (!result.ok) {
    return {
      error: result.reason === "rate_limited"
        ? "Demasiados intentos. Espera unos minutos."
        : "Correo o contraseña incorrectos.",
    };
  }

  setSessionCookie(
    await cookies(),
    result.token,
    new Date(Date.now() + 12 * 60 * 60 * 1000),
    getEnv().APP_ENV,
  );
  revalidatePath("/admin", "layout");
  redirect(adminHref());
}
