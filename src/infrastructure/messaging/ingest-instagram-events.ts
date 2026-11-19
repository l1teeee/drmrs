import { ingestInstagramEvents } from "@/application/messaging/ingest-instagram-events";
import type { InstagramWebhookEvent } from "@/application/messaging/instagram-events";
import { postgresMessagingRepository } from "@/infrastructure/db/repositories/postgres-messaging-repository";
import { loadInstagramMessenger } from "@/infrastructure/instagram/instagram-messenger";
import { log } from "@/infrastructure/observability/logger";

import { drainMessageOutbox } from "./drain-message-outbox";

export async function ingestConfiguredInstagramEvents(
  events: readonly InstagramWebhookEvent[],
  options: { ownAccountId: string | null; deadline?: number },
) {
  const messenger = await loadInstagramMessenger();
  if (!messenger) throw new Error("Instagram is not connected");
  const result = await ingestInstagramEvents(
    {
      repository: postgresMessagingRepository,
      messenger,
      logFailure: (fields) => log("error", "instagram_ingestion_followup_failed", fields),
    },
    events,
    options,
  );
  return {
    ...result,
    async after() {
      const linkReleased = await result.after();
      if (result.released + linkReleased > 0) {
        await drainMessageOutbox({ limit: 50, timeBudgetMs: 20_000 });
      }
    },
  };
}
