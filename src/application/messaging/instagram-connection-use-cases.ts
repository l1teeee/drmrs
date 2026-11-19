import {
  InstagramOAuthError,
  type InstagramConnectionRepository,
  type UnifiedLoginClient,
} from "./instagram-connection";

type ConnectionResult =
  | { ok: true; username: string }
  | {
      ok: false;
      error: "TOKEN_EXCHANGE_FAILED" | "MISSING_PERMISSION" | "WRONG_ACCOUNT" | "SUBSCRIBE_FAILED";
    };

export async function completeUnifiedInstagramConnection(
  deps: { client: UnifiedLoginClient; repository: InstagramConnectionRepository },
  input: { code: string; adminId: string; requiredUsername: string },
): Promise<ConnectionResult> {
  let token: string;
  let inspection: { scopes: string[]; expiresAt: Date | null };
  let accounts: Array<{ accountId: string; username: string }>;
  try {
    token = await deps.client.exchangeCode(input.code);
    inspection = await deps.client.inspectToken(token);
    accounts = await deps.client.listAccounts(token);
  } catch (error) {
    if (error instanceof InstagramOAuthError) return { ok: false, error: "TOKEN_EXCHANGE_FAILED" };
    throw error;
  }
  if (
    !inspection.scopes.includes("instagram_basic") ||
    !inspection.scopes.includes("instagram_manage_messages")
  ) {
    return { ok: false, error: "MISSING_PERMISSION" };
  }
  const account = accounts.find(
    (candidate) => candidate.username.toLowerCase() === input.requiredUsername.toLowerCase(),
  );
  if (!account) return { ok: false, error: "WRONG_ACCOUNT" };
  try {
    await deps.client.subscribeWebhooks(token, account.accountId);
  } catch (error) {
    if (error instanceof InstagramOAuthError) return { ok: false, error: "SUBSCRIBE_FAILED" };
    throw error;
  }
  await deps.repository.save({
    accountId: account.accountId,
    username: account.username.toLowerCase(),
    accessToken: token,
    tokenExpiresAt: inspection.expiresAt,
    adminId: input.adminId,
  });
  return { ok: true, username: account.username };
}

export async function disconnectInstagram(
  deps: { repository: InstagramConnectionRepository },
  adminId: string,
): Promise<{ ok: true } | { ok: false; error: "NOT_CONNECTED" }> {
  return (await deps.repository.delete(adminId))
    ? { ok: true }
    : { ok: false, error: "NOT_CONNECTED" };
}
