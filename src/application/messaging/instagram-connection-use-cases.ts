import {
  InstagramOAuthError,
  type InstagramConnectionRepository,
  type UnifiedLoginClient,
} from "./instagram-connection";

type ConnectionResult =
  | { ok: true; username: string }
  | {
      ok: false;
      error:
        | "TOKEN_EXCHANGE_FAILED"
        | "MISSING_PERMISSION"
        | "WRONG_ACCOUNT"
        | "SUBSCRIBE_FAILED"
        | "NO_ACCOUNT"
        | "MULTIPLE_ACCOUNTS";
    };

export async function completeUnifiedInstagramConnection(
  deps: { client: UnifiedLoginClient; repository: InstagramConnectionRepository },
  input: { code: string; adminId: string; requiredUsername: string | null },
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
  let account: { accountId: string; username: string };
  if (input.requiredUsername !== null) {
    const requiredUsername = input.requiredUsername.toLowerCase();
    const matching = accounts.find(
      (candidate) => candidate.username.toLowerCase() === requiredUsername,
    );
    if (!matching) return { ok: false, error: "WRONG_ACCOUNT" };
    account = matching;
  } else {
    if (accounts.length === 0) return { ok: false, error: "NO_ACCOUNT" };
    if (accounts.length > 1) return { ok: false, error: "MULTIPLE_ACCOUNTS" };
    account = accounts[0]!;
  }
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
