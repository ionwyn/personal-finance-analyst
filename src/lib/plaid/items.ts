import { SyncSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaid/client";
import { refreshAccountsForItem, refreshBalancesForItem } from "@/lib/plaid/accounts";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { encryptToken } from "@/lib/security/token-crypto";
import {
  elapsedMs,
  ensureRequestId,
  logger,
  normalizeSyncSource,
  safeError,
  withLogContext,
} from "@/lib/logger";

export async function exchangeAndStorePlaidItem(input: {
  tenantId: string;
  userId?: string;
  publicToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
  source?: SyncSource;
}) {
  const source = input.source ?? SyncSource.MANUAL;

  return withLogContext(
    {
      requestId: ensureRequestId(),
      provider: "plaid",
      tenantId: input.tenantId,
      syncSource: normalizeSyncSource(source),
    },
    async () => {
      const startedAt = performance.now();
      logger.info("plaid item exchange started");

      try {
        const response = await getPlaidClient().itemPublicTokenExchange({
          public_token: input.publicToken,
        });

        const item = await prisma.plaidItem.upsert({
          where: {
            plaidItemId: response.data.item_id,
          },
          update: {
            tenantId: input.tenantId,
            createdById: input.userId,
            accessTokenEncrypted: encryptToken(response.data.access_token),
            institutionId: input.institutionId,
            institutionName: input.institutionName,
            errorCode: null,
            errorMessage: null,
          },
          create: {
            tenantId: input.tenantId,
            createdById: input.userId,
            plaidItemId: response.data.item_id,
            accessTokenEncrypted: encryptToken(response.data.access_token),
            institutionId: input.institutionId,
            institutionName: input.institutionName,
          },
        });

        await refreshAccountsForItem(item.id);
        await syncPlaidItem(item.id, source);
        await refreshBalancesForItem(item.id);

        logger.info(
          {
            duration: elapsedMs(startedAt),
            itemId: item.id,
          },
          "plaid item exchange completed"
        );
        return item;
      } catch (error) {
        logger.error(
          {
            duration: elapsedMs(startedAt),
            error: safeError(error),
          },
          "plaid item exchange failed"
        );
        throw error;
      }
    }
  );
}
