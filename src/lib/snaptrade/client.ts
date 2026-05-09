import { Snaptrade } from "snaptrade-typescript-sdk";

import { getBaseUrl } from "@/lib/env";
import { decryptToken } from "@/lib/security/token-crypto";

function firstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

function requireFirstEnv(names: string[]) {
  const value = firstEnv(names);
  if (!value) {
    throw new Error(`Missing required environment variable: ${names[0]}`);
  }
  return value;
}

export function getSnapTradeClient() {
  return new Snaptrade({
    clientId: requireFirstEnv(["SNAPTRADE_CLIENT_ID", "client_id"]),
    consumerKey: requireFirstEnv(["SNAPTRADE_CONSUMER_KEY", "consumer_key"])
  });
}

export function getSnapTradeCredentials() {
  const userSecretEncrypted = firstEnv(["SNAPTRADE_USER_SECRET_ENCRYPTED"]);
  return {
    userId: requireFirstEnv(["SNAPTRADE_USER_ID", "userid", "user_id"]),
    userSecret: userSecretEncrypted
      ? decryptToken(userSecretEncrypted)
      : requireFirstEnv(["SNAPTRADE_USER_SECRET", "usersecret", "user_secret"])
  };
}

export async function createSnapTradeConnectionPortal(input: {
  reconnectAuthorizationId?: string;
}) {
  const { userId, userSecret } = getSnapTradeCredentials();
  const response = await getSnapTradeClient().authentication.loginSnapTradeUser({
    userId,
    userSecret,
    reconnect: input.reconnectAuthorizationId,
    connectionType: "read",
    connectionPortalVersion: "v4",
    showCloseButton: true,
    customRedirect: `${getBaseUrl()}/app/accounts`
  });

  const data = response.data;
  if ("redirectURI" in data && data.redirectURI) {
    return {
      redirectURI: data.redirectURI,
      sessionId: data.sessionId ?? null
    };
  }

  throw new Error("SnapTrade returned an encrypted login response; SSH-encrypted connection portal responses are not supported.");
}
