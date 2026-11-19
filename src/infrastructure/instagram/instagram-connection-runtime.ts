import {
  completeUnifiedInstagramConnection,
  disconnectInstagram,
} from "@/application/messaging/instagram-connection-use-cases";
import { getEnv } from "@/infrastructure/config/env";
import { postgresInstagramConnectionRepository } from "@/infrastructure/db/repositories/postgres-instagram-connection-repository";

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

export function instagramAuthorizationUrl(state: string): string {
  return unifiedLoginClient().authorizationUrl(state);
}

export function completeConfiguredInstagramConnection(code: string, adminId: string) {
  const environment = getEnv();
  return completeUnifiedInstagramConnection(
    { client: unifiedLoginClient(), repository: postgresInstagramConnectionRepository },
    {
      code,
      adminId,
      requiredUsername: environment.INSTAGRAM_ALLOW_ANY_ACCOUNT
        ? null
        : (environment.INSTAGRAM_BUSINESS_USERNAME ?? null),
    },
  );
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
