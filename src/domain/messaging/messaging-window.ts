const MESSAGING_WINDOW_MS = (24 * 60 - 5) * 60 * 1000;

export function messagingWindowRemainingMs(lastInboundAt: Date | null, now: Date): number {
  if (lastInboundAt === null) return 0;
  return Math.max(0, MESSAGING_WINDOW_MS - (now.getTime() - lastInboundAt.getTime()));
}

export function isMessagingWindowOpen(lastInboundAt: Date | null, now: Date): boolean {
  return messagingWindowRemainingMs(lastInboundAt, now) > 0;
}
