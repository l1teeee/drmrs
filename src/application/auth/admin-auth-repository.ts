export type AdminForSignIn = {
  id: string;
  passwordHash: string;
  isActive: boolean;
  lockedUntilPassed: boolean;
};

export type AdminSession = {
  sessionId: string;
  adminId: string;
  displayName: string;
  email: string;
  role: "OWNER" | "ADMIN";
};

export type AdminAuthAudit =
  | { action: "ADMIN_SIGN_IN_FAILED"; metadata: { reason: "password" | "locked" } }
  | { action: "ADMIN_SIGNED_OUT"; metadata: Record<string, never> };

export interface AdminAuthRepository {
  findAdminForSignIn(emailNormalized: string): Promise<AdminForSignIn | null>;
  recordFailedSignIn(adminId: string): Promise<{ locked: boolean }>;
  createSession(adminId: string, tokenHash: string): Promise<void>;
  findSession(tokenHash: string): Promise<AdminSession | null>;
  deleteSession(tokenHash: string): Promise<void>;
  recordAudit(
    adminId: string | null,
    action: AdminAuthAudit["action"],
    metadata: AdminAuthAudit["metadata"],
  ): Promise<void>;
}
