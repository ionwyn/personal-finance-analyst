import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid";

import { getPlaidEnv, getPlaidWebhookUrl, requireEnv } from "@/lib/env";
import { elapsedMs, ensureRequestId, logger, safeError, withLogContext } from "@/lib/logger";

export function getPlaidClient() {
  const env = getPlaidEnv();
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": requireEnv("PLAID_CLIENT_ID"),
        "PLAID-SECRET": requireEnv("PLAID_SECRET"),
      },
    },
  });

  return new PlaidApi(configuration);
}

export async function createTransactionsLinkToken(clientUserId: string) {
  return withLogContext({ requestId: ensureRequestId(), provider: "plaid" }, async () => {
    const startedAt = performance.now();
    logger.info("plaid link token create started");

    try {
      const response = await getPlaidClient().linkTokenCreate({
        client_name: requireEnv("PLAID_CLIENT_NAME"),
        country_codes: [CountryCode.Ca],
        language: "en",
        products: [Products.Transactions],
        webhook: getPlaidWebhookUrl(),
        user: {
          client_user_id: clientUserId,
        },
        transactions: {
          days_requested: 730,
        },
      });

      logger.info({ duration: elapsedMs(startedAt) }, "plaid link token create completed");
      return response.data.link_token;
    } catch (error) {
      logger.error(
        {
          duration: elapsedMs(startedAt),
          error: safeError(error),
        },
        "plaid link token create failed"
      );
      throw error;
    }
  });
}

/**
 * Create a Link token in **update mode** to repair an item that needs
 * re-authentication (e.g. ITEM_LOGIN_REQUIRED). No `products` are passed —
 * update mode is keyed on the existing item's `access_token`.
 */
export async function createUpdateLinkToken(clientUserId: string, accessToken: string) {
  return withLogContext({ requestId: ensureRequestId(), provider: "plaid" }, async () => {
    const startedAt = performance.now();
    logger.info("plaid update link token create started");

    try {
      const response = await getPlaidClient().linkTokenCreate({
        client_name: requireEnv("PLAID_CLIENT_NAME"),
        country_codes: [CountryCode.Ca],
        language: "en",
        webhook: getPlaidWebhookUrl(),
        user: {
          client_user_id: clientUserId,
        },
        access_token: accessToken,
      });

      logger.info({ duration: elapsedMs(startedAt) }, "plaid update link token create completed");
      return response.data.link_token;
    } catch (error) {
      logger.error(
        { duration: elapsedMs(startedAt), error: safeError(error) },
        "plaid update link token create failed"
      );
      throw error;
    }
  });
}

/**
 * Revoke an item with Plaid via `/item/remove`. Invalidates the access token so
 * no further data can be pulled. Plaid does not delete locally-stored data — the
 * caller is responsible for purging rows after this resolves.
 */
export async function removePlaidItem(accessToken: string) {
  return withLogContext({ requestId: ensureRequestId(), provider: "plaid" }, async () => {
    const startedAt = performance.now();
    logger.info("plaid item remove started");

    try {
      await getPlaidClient().itemRemove({ access_token: accessToken });
      logger.info({ duration: elapsedMs(startedAt) }, "plaid item remove completed");
    } catch (error) {
      logger.error(
        { duration: elapsedMs(startedAt), error: safeError(error) },
        "plaid item remove failed"
      );
      throw error;
    }
  });
}
