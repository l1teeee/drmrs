import { isMessagingWindowOpen } from "@/domain/messaging/messaging-window";
import { splitIntoChunks } from "@/domain/messaging/text-chunks";

import type { InstagramMessenger } from "./instagram-messenger";
import { classifyMessageDeliveryFailure } from "./message-delivery-policy";
import type { ClaimedMessage, MessageOutbox } from "./message-outbox";

export interface MessageDeliverySummary {
  sent: number;
  retried: number;
  failed: number;
  waitingWindow: number;
}

export interface DeliverMessagesDependencies {
  outbox: MessageOutbox;
  messenger: InstagramMessenger;
  now: () => number;
  logFailure(fields: { messageId: string; errorCode: string }): void;
}

async function recordFailure(
  deps: DeliverMessagesDependencies,
  message: ClaimedMessage,
  error: unknown,
  summary: MessageDeliverySummary,
): Promise<void> {
  const failure = classifyMessageDeliveryFailure(error, message.attempts + 1);
  if (failure.action === "WAIT_WINDOW") {
    if (await deps.outbox.waitForWindow(message.id, message.lease)) summary.waitingWindow += 1;
  } else if (failure.action === "RETRY") {
    if (await deps.outbox.retry(message.id, message.lease, failure.delaySeconds, failure.errorCode)) {
      summary.retried += 1;
    }
  } else if (await deps.outbox.fail(message.id, message.lease, failure.errorCode)) {
    summary.failed += 1;
  }
  deps.logFailure({ messageId: message.id, errorCode: failure.errorCode });
}

// The part is already sent: a failed bookkeeping write must not abort the drain. After the retry
// the lease expires and the message is picked up again.
async function recordSentPart(
  deps: DeliverMessagesDependencies,
  message: ClaimedMessage,
  partIndex: number,
  externalPartId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await deps.outbox.recordPart(message.id, message.lease, partIndex, externalPartId);
    } catch {
      deps.logFailure({ messageId: message.id, errorCode: "RECORD_PART_FAILED" });
    }
  }
  return false;
}

async function deliverClaimedMessage(
  deps: DeliverMessagesDependencies,
  message: ClaimedMessage,
  deadlineMs: number,
  summary: MessageDeliverySummary,
): Promise<void> {
  if (!isMessagingWindowOpen(message.lastInboundAt, new Date(deps.now()))) {
    if (await deps.outbox.waitForWindow(message.id, message.lease)) summary.waitingWindow += 1;
    return;
  }
  const parts = splitIntoChunks(message.body);
  for (let index = message.partsSent; index < parts.length; index += 1) {
    if (deps.now() >= deadlineMs) return;
    let response: { messageId: string };
    try {
      response = await deps.messenger.sendText(message.recipientId, parts[index]!);
      if (!response.messageId) throw new Error("META_NO_MESSAGE_ID");
    } catch (error) {
      await recordFailure(deps, message, error, summary);
      return;
    }
    const recorded = await recordSentPart(deps, message, index, response.messageId);
    if (!recorded) return;
  }
  if (await deps.outbox.complete(message.id, message.lease)) summary.sent += 1;
}

export async function deliverPendingMessages(
  deps: DeliverMessagesDependencies,
  input: { limit: number; deadlineMs: number },
): Promise<MessageDeliverySummary> {
  const summary: MessageDeliverySummary = { sent: 0, retried: 0, failed: 0, waitingWindow: 0 };
  let claimed = 0;
  while (claimed < input.limit && deps.now() < input.deadlineMs) {
    const batch = await deps.outbox.claimDue(Math.min(10, input.limit - claimed));
    if (batch.length === 0) break;
    claimed += batch.length;
    for (const message of batch) {
      if (deps.now() >= input.deadlineMs) return summary;
      await deliverClaimedMessage(deps, message, input.deadlineMs, summary);
    }
  }
  return summary;
}
