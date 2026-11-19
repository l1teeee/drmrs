import type { InstagramMessenger } from "./instagram-messenger";
import type { InstagramEventRepository } from "./instagram-event-ingestion";
import type { InstagramWebhookEvent } from "./instagram-events";

export interface InstagramIngestionDependencies {
  repository: InstagramEventRepository;
  messenger: InstagramMessenger;
  logFailure(fields: { errorCode: string }): void;
}

export interface InstagramIngestionResult {
  contactIdsNeedingProfile: string[];
  released: number;
  /** Runs the profile and link follow-up; resolves with the messages it released to QUEUED. */
  after(): Promise<number>;
}

function normalizedUsername(username: string | null): string | null {
  const value = username?.trim().replace(/^@/, "").toLowerCase() ?? null;
  return value && /^[a-z0-9._]{1,30}$/.test(value) ? value : null;
}

function normalizedName(name: string | null): string | null {
  const value = name?.trim();
  return value ? [...value].slice(0, 100).join("") : null;
}

export async function ingestInstagramEvents(
  dependencies: InstagramIngestionDependencies,
  events: readonly InstagramWebhookEvent[],
  options: { ownAccountId: string | null; deadline?: number },
): Promise<InstagramIngestionResult> {
  const transaction = await dependencies.repository.ingestEvents(events, options.ownAccountId);
  return {
    contactIdsNeedingProfile: transaction.contacts
      .filter((contact) => !contact.username)
      .map((contact) => contact.contactId),
    released: transaction.released,
    async after() {
      let linkReleased = 0;
      for (const contact of transaction.contacts) {
        if (options.deadline !== undefined && Date.now() >= options.deadline) return linkReleased;
        let username = normalizedUsername(contact.username);
        if (!username) {
          try {
            const profile = await dependencies.messenger.fetchProfile(contact.recipientId);
            username = normalizedUsername(profile.username);
            await dependencies.repository.storeProfile(
              contact.contactId, username, normalizedName(profile.name),
            );
          } catch {
            dependencies.logFailure({ errorCode: "PROFILE_FETCH_FAILED" });
            continue;
          }
        }
        if (username) {
          try {
            linkReleased += await dependencies.repository.linkByUsername(contact.contactId, username);
          } catch {
            dependencies.logFailure({ errorCode: "USERNAME_LINK_FAILED" });
          }
        }
      }
      return linkReleased;
    },
  };
}
