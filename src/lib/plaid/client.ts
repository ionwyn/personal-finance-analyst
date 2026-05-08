import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products
} from "plaid";

import { getPlaidEnv, getPlaidWebhookUrl, requireEnv } from "@/lib/env";

export function getPlaidClient() {
  const env = getPlaidEnv();
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": requireEnv("PLAID_CLIENT_ID"),
        "PLAID-SECRET": requireEnv("PLAID_SECRET")
      }
    }
  });

  return new PlaidApi(configuration);
}

export async function createTransactionsLinkToken(clientUserId: string) {
  const response = await getPlaidClient().linkTokenCreate({
    client_name: "TD Finance Analytics",
    country_codes: [CountryCode.Us],
    language: "en",
    products: [Products.Transactions],
    webhook: getPlaidWebhookUrl(),
    user: {
      client_user_id: clientUserId
    },
    transactions: {
      days_requested: 730
    }
  });

  return response.data.link_token;
}
