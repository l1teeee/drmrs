export interface InstagramConnection {
  accountId: string;
  username: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
  tokenVersion: number;
  connectedAt: Date;
  connectedByAdminId: string | null;
}

export interface InstagramConnectionRepository {
  find(): Promise<InstagramConnection | null>;
  findTokenExpiry(): Promise<{ expiresAt: Date | null } | null>;
  save(input: {
    accountId: string;
    username: string;
    accessToken: string;
    tokenExpiresAt: Date | null;
    adminId: string;
  }): Promise<void>;
  delete(adminId: string): Promise<boolean>;
}

export class InstagramOAuthError extends Error {}

export interface UnifiedLoginClient {
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<string>;
  inspectToken(accessToken: string): Promise<{ scopes: string[]; expiresAt: Date | null }>;
  listAccounts(accessToken: string): Promise<Array<{ accountId: string; username: string }>>;
  subscribeWebhooks(accessToken: string, accountId: string): Promise<void>;
}
