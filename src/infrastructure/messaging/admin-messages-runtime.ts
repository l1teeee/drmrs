import type { AdminMessagesDependencies } from "@/application/messaging/admin-messages";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { postgresAdminMessageRepository } from "@/infrastructure/db/repositories/postgres-admin-message-repository";
import { consume, RATE_LIMITS } from "@/infrastructure/rate-limit/postgres-rate-limiter";

import { scheduleMessageDelivery } from "./schedule-message-delivery";

export function adminMessagesDependencies(): AdminMessagesDependencies {
  return {
    store: postgresAdminMessageRepository,
    registros: adminRegistrosDependencies(),
    checkAdminAction: (subject) => consume({ ...RATE_LIMITS.adminAction, subject }),
    scheduleDelivery: scheduleMessageDelivery,
  };
}
