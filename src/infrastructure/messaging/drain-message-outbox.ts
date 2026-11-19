import {
  deliverPendingMessages,
  type MessageDeliverySummary,
} from "@/application/messaging/deliver-messages";
import { postgresMessageOutboxRepository } from "@/infrastructure/db/repositories/postgres-message-outbox-repository";
import { loadInstagramMessenger } from "@/infrastructure/instagram/instagram-messenger";
import { log } from "@/infrastructure/observability/logger";

export async function drainMessageOutbox(input: {
  limit: number;
  timeBudgetMs: number;
}): Promise<MessageDeliverySummary> {
  const deadlineMs = Date.now() + input.timeBudgetMs;
  const messenger = await loadInstagramMessenger();
  if (!messenger) {
    log("warn", "instagram_not_connected");
    return { sent: 0, retried: 0, failed: 0, waitingWindow: 0 };
  }
  return deliverPendingMessages(
    {
      outbox: postgresMessageOutboxRepository,
      messenger,
      now: Date.now,
      logFailure: (fields) => log("error", "instagram_message_delivery_failed", fields),
    },
    { limit: input.limit, deadlineMs },
  );
}
