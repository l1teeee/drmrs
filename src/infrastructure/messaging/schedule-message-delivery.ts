import { after } from "next/server";

import { log, safeErrorCode } from "@/infrastructure/observability/logger";

import { drainMessageOutbox } from "./drain-message-outbox";

export function scheduleMessageDelivery(): void {
  after(async () => {
    try {
      await drainMessageOutbox({ limit: 50, timeBudgetMs: 20_000 });
    } catch (error) {
      log("error", "instagram_message_outbox_drain_failed", { errorCode: safeErrorCode(error) });
    }
  });
}
