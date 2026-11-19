export type RateLimitCheck = (
  subject: string,
) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;
