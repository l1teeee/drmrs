import type { InstagramConnectionKind } from "@/application/messaging/instagram-connection";
import {
  completeInstagramConnection,
  completeUnifiedInstagramConnection,
  disconnectInstagram,
  refreshInstagramTokenIfDue,
} from "@/application/messaging/instagram-connection-use-cases";
import { getEnv } from "@/infrastructure/config/env";
import { postgresInstagramConnectionRepository } from "@/infrastructure/db/repositories/postgres-instagram-connection-repository";

import { GraphInstagramOAuthClient } from "./graph-instagram-oauth-client";
import { GraphUnifiedLoginClient } from "./graph-unified-login-client";

export type InstagramConnectionStatus =
  | { mode: "disabled" | "log" }
  | {
      mode: "instagram";
      connection: {
        username: string;
        connectedAt: Date;
        tokenExpiresAt: Date | null;
      } | null;
    };

export function instagramRedirectUri(): string {
  return new URL("/api/instagram/callback", getEnv().APP_BASE_URL).toString();
}

let unifiedClient: GraphUnifiedLoginClient | undefined;

function unifiedLoginClient(): GraphUnifiedLoginClient {
  const environment = getEnv();
  if (environment.MESSAGING_MODE !== "instagram") throw new Error("Instagram mode is not configured");
  unifiedClient ??= new GraphUnifiedLoginClient({
    appId: environment.META_APP_ID!,
    appSecret: environment.META_APP_SECRET!,
    configId: environment.INSTAGRAM_LOGIN_CONFIG_ID!,
    redirectUri: instagramRedirectUri(),
    graphBaseUrl: environment.META_GRAPH_API_BASE_URL,
  });
  return unifiedClient;
}

function instagramLinkFlow(): InstagramConnectionKind {
  const environment = getEnv();
  return environment.META_APP_ID && environment.META_APP_SECRET && environment.INSTAGRAM_LOGIN_CONFIG_ID
    ? "UNIFIED_LOGIN"
    : "INSTAGRAM_LOGIN";
}

let instagramLoginClient: GraphInstagramOAuthClient | undefined;

function instagramOAuthClient(): GraphInstagramOAuthClient {
  const environment = getEnv();
  if (environment.MESSAGING_MODE !== "instagram") throw new Error("Instagram mode is not configured");
  if (!environment.INSTAGRAM_APP_ID || !environment.INSTAGRAM_APP_SECRET) {
    throw new Error("Instagram Login is not configured");
  }
  instagramLoginClient ??= new GraphInstagramOAuthClient({
    appId: environment.INSTAGRAM_APP_ID,
    appSecret: environment.INSTAGRAM_APP_SECRET,
    redirectUri: instagramRedirectUri(),
    graphBaseUrl: environment.INSTAGRAM_GRAPH_API_BASE_URL,
  });
  return instagramLoginClient;
}

export function instagramAuthorizationUrl(state: string): string {
  return instagramLinkFlow() === "UNIFIED_LOGIN"
    ? unifiedLoginClient().authorizationUrl(state)
    : instagramOAuthClient().authorizationUrl(state);
}

export function completeConfiguredInstagramConnection(code: string, adminId: string) {
  const environment = getEnv();
  const input = {
    code,
    adminId,
    requiredUsername: environment.INSTAGRAM_ALLOW_ANY_ACCOUNT
      ? null
      : (environment.INSTAGRAM_BUSINESS_USERNAME ?? null),
  };
  if (instagramLinkFlow() === "UNIFIED_LOGIN") {
    return completeUnifiedInstagramConnection(
      { client: unifiedLoginClient(), repository: postgresInstagramConnectionRepository },
      input,
    );
  }
  return completeInstagramConnection(
    {
      oauth: instagramOAuthClient(),
      repository: postgresInstagramConnectionRepository,
      now: () => new Date(),
    },
    input,
  );
}

export function refreshConfiguredInstagramToken() {
  const environment = getEnv();
  const oauth = environment.INSTAGRAM_APP_ID && environment.INSTAGRAM_APP_SECRET ? instagramOAuthClient() : null;
  return refreshInstagramTokenIfDue({
    oauth,
    repository: postgresInstagramConnectionRepository,
    now: () => new Date(),
  });
}

export function disconnectConfiguredInstagram(adminId: string) {
  return disconnectInstagram({ repository: postgresInstagramConnectionRepository }, adminId);
}

export async function loadInstagramConnectionStatus(): Promise<InstagramConnectionStatus> {
  const mode = getEnv().MESSAGING_MODE;
  if (mode !== "instagram") return { mode };
  const connection = await postgresInstagramConnectionRepository.find();
  return {
    mode,
    connection: connection ? {
      username: connection.username,
      connectedAt: connection.connectedAt,
      tokenExpiresAt: connection.tokenExpiresAt,
    } : null,
  };
}
