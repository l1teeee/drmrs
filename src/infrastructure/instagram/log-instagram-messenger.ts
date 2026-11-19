import { randomUUID } from "node:crypto";

import type { InstagramMessenger } from "@/application/messaging/instagram-messenger";
import { log } from "@/infrastructure/observability/logger";

export class LogInstagramMessenger implements InstagramMessenger {
  async sendText(): Promise<{ messageId: string }> {
    log("info", "instagram_message_logged");
    return { messageId: `log-${randomUUID()}` };
  }

  async fetchProfile(): Promise<{ username: null; name: null }> {
    return { username: null, name: null };
  }
}
