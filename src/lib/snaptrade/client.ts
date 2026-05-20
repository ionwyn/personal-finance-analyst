import { Snaptrade } from "snaptrade-typescript-sdk";

import { getBaseUrl } from "@/lib/env";
import { elapsedMs, ensureRequestId, logger, safeError, withLogContext } from "@/lib/logger";
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
    consumerKey: requireFirstEnv(["SNAPTRADE_CONSUMER_KEY", "consumer_key"]),
  });
}

export function getSnapTradeCredentials() {
  return {
    userId: requireFirstEnv(["SNAPTRADE_USER_ID", "userid", "user_id"]),
    userSecret: decryptToken(requireFirstEnv(["SNAPTRADE_USER_SECRET_ENCRYPTED"])),
  };
}

export async function createSnapTradeConnectionPortal(input: {
  reconnectAuthorizationId?: string;
}) {
  return withLogContext({ requestId: ensureRequestId(), provider: "snaptrade" }, async () => {
    const startedAt = performance.now();
    logger.info("snaptrade connection portal create started");

    try {
      const { userId, userSecret } = getSnapTradeCredentials();
      const response = await getSnapTradeClient().authentication.loginSnapTradeUser({
        userId,
        userSecret,
        reconnect: input.reconnectAuthorizationId,
        connectionType: "read",
        connectionPortalVersion: "v4",
        showCloseButton: true,
        customRedirect: `${getBaseUrl()}/app/accounts`,
      });

      const data = response.data;
      if ("redirectURI" in data && data.redirectURI) {
        logger.info(
          { duration: elapsedMs(startedAt) },
          "snaptrade connection portal create completed"
        );
        return {
          redirectURI: data.redirectURI,
          sessionId: data.sessionId ?? null,
        };
      }

      throw new Error(
        "SnapTrade returned an encrypted login response; SSH-encrypted connection portal responses are not supported."
      );
    } catch (error) {
      logger.error(
        {
          duration: elapsedMs(startedAt),
          error: safeError(error),
        },
        "snaptrade connection portal create failed"
      );
      throw error;
    }
  });
}
