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
        client_name: "TD Finance Analytics",
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
