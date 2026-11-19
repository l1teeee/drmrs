import type { InstagramWebhookEvent } from "./instagram-events";

export interface IngestedContactReference {
  contactId: string;
  recipientId: string;
  username: string | null;
}

export interface InstagramIngestionTransactionResult {
  contacts: IngestedContactReference[];
  released: number;
}

export interface InstagramEventRepository {
  ingestEvents(
    events: readonly InstagramWebhookEvent[],
    ownAccountId: string | null,
  ): Promise<InstagramIngestionTransactionResult>;
  storeProfile(contactId: string, username: string | null, displayName: string | null): Promise<void>;
  /** Returns how many messages the link moved to QUEUED. */
  linkByUsername(contactId: string, username: string): Promise<number>;
}
