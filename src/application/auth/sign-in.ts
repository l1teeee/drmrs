import type { RateLimitCheck } from "@/application/ports/rate-limit";

import type { AdminAuthRepository } from "./admin-auth-repository";

export interface SignInDependencies {
  repository: AdminAuthRepository;
  passwordVerifier: (password: string, encoded: string) => Promise<boolean>;
  dummyPasswordHash: string;
  generateToken: () => string;
  hashToken: (token: string) => string;
  checkIp: RateLimitCheck;
  checkEmail: RateLimitCheck;
}

export type SignInResult =
  | { ok: true; token: string }
  | { ok: false; reason: "invalid" | "rate_limited" };

export async function signIn(
  input: { email: string; password: string; rateLimitSubject: string },
  dependencies: SignInDependencies,
): Promise<SignInResult> {
  const emailNormalized = input.email.trim().toLowerCase();
  const [ipLimit, emailLimit] = await Promise.all([
    dependencies.checkIp(input.rateLimitSubject),
    dependencies.checkEmail(emailNormalized),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { ok: false, reason: "rate_limited" };
  }

  const admin = await dependencies.repository.findAdminForSignIn(emailNormalized);
  const encodedHash = admin?.isActive ? admin.passwordHash : dependencies.dummyPasswordHash;
  const passwordMatches = await dependencies.passwordVerifier(input.password, encodedHash);
  if (!admin?.isActive) {
    return { ok: false, reason: "invalid" };
  }

  if (!admin.lockedUntilPassed) {
    await dependencies.repository.recordAudit(admin.id, "ADMIN_SIGN_IN_FAILED", { reason: "locked" });
    return { ok: false, reason: "invalid" };
  }

  if (!passwordMatches) {
    await dependencies.repository.recordFailedSignIn(admin.id);
    await dependencies.repository.recordAudit(admin.id, "ADMIN_SIGN_IN_FAILED", { reason: "password" });
    return { ok: false, reason: "invalid" };
  }

  const token = dependencies.generateToken();
  await dependencies.repository.createSession(admin.id, dependencies.hashToken(token));
  return { ok: true, token };
}
