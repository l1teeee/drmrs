import type { DropsDependencies } from "@/application/drops/drops";

import { postgresDropRepository } from "../db/repositories/postgres-drop-repository";
import { consume, RATE_LIMITS } from "../rate-limit/postgres-rate-limiter";

export function dropsDependencies(): DropsDependencies {
  return {
    store: postgresDropRepository,
    checkAdminAction: (subject) => consume({ ...RATE_LIMITS.adminAction, subject }),
  };
}
