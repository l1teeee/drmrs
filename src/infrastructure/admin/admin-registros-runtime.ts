import type { AdminRegistrosDependencies } from "@/application/admin-registros/admin-registros";

import { getEnv } from "../config/env";
import { expedienteCodes } from "../crypto/expediente-code";
import { postgresAdminRegistroRepository } from "../db/repositories/postgres-admin-registro-repository";
import { consume, RATE_LIMITS } from "../rate-limit/postgres-rate-limiter";

export function adminRegistrosDependencies(): AdminRegistrosDependencies {
  return {
    store: postgresAdminRegistroRepository,
    codes: expedienteCodes,
    baseUrl: getEnv().APP_BASE_URL,
    checkAdminAction: (subject) => consume({ ...RATE_LIMITS.adminAction, subject }),
  };
}
