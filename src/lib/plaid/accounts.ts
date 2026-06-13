import type { AccountBase } from "plaid";

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/security/token-crypto";
import { getPlaidClient } from "@/lib/plaid/client";
import { normalizeAccount } from "@/lib/plaid/normalize";
import { elapsedMs, ensureRequestId, logger, safeError, withLogContext } from "@/lib/logger";

export async function upsertPlaidAccounts(input: {
  tenantId: string;
  itemId: string;
  accounts: AccountBase[];
  captureSnapshot?: boolean;
}) {
  const now = new Date();
  let count = 0;

  for (const account of input.accounts) {
    const normalized = normalizeAccount(account);
    const saved = await prisma.plaidAccount.upsert({
      where: { plaidAccountId: normalized.plaidAccountId },
      update: {
        name: normalized.name,
        officialName: normalized.officialName,
        type: normalized.type,
        subtype: normalized.subtype,
        mask: normalized.mask,
        isoCurrencyCode: normalized.isoCurrencyCode,
        unofficialCurrencyCode: normalized.unofficialCurrencyCode,
        availableBalance: normalized.availableBalance,
        currentBalance: normalized.currentBalance,
        limit: normalized.limit,
        lastBalanceAt: input.captureSnapshot ? now : undefined,
      },
      create: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        plaidAccountId: normalized.plaidAccountId,
        name: normalized.name,
        officialName: normalized.officialName,
        type: normalized.type,
        subtype: normalized.subtype,
        mask: normalized.mask,
        isoCurrencyCode: normalized.isoCurrencyCode,
        unofficialCurrencyCode: normalized.unofficialCurrencyCode,
        availableBalance: normalized.availableBalance,
        currentBalance: normalized.currentBalance,
        limit: normalized.limit,
        lastBalanceAt: input.captureSnapshot ? now : null,
      },
    });

    if (input.captureSnapshot && saved.tracked) {
      await prisma.balanceSnapshot.create({
        data: {
          tenantId: input.tenantId,
          accountId: saved.id,
          availableBalance: normalized.availableBalance,
          currentBalance: normalized.currentBalance,
          limit: normalized.limit,
          isoCurrencyCode: normalized.isoCurrencyCode,
          unofficialCurrencyCode: normalized.unofficialCurrencyCode,
          capturedAt: now,
          raw: account as never,
        },
      });
    }

    count += 1;
  }

  return count;
}

export async function refreshAccountsForItem(itemId: string) {
  const item = await prisma.plaidItem.findUniqueOrThrow({
    where: { id: itemId },
  });

  return withLogContext(
    {
      requestId: ensureRequestId(),
      provider: "plaid",
      tenantId: item.tenantId,
    },
    async () => {
      const startedAt = performance.now();
      logger.info({ itemId: item.id }, "plaid accounts refresh started");

      try {
        const accessToken = decryptToken(item.accessTokenEncrypted);
        const response = await getPlaidClient().accountsGet({ access_token: accessToken });

        const accountsCount = await upsertPlaidAccounts({
          tenantId: item.tenantId,
          itemId: item.id,
          accounts: response.data.accounts,
        });

        logger.info(
          {
            duration: elapsedMs(startedAt),
            itemId: item.id,
            accountsCount,
          },
          "plaid accounts refresh completed"
        );
        return accountsCount;
      } catch (error) {
        logger.error(
          {
            duration: elapsedMs(startedAt),
            itemId: item.id,
            error: safeError(error),
          },
          "plaid accounts refresh failed"
        );
        throw error;
      }
    }
  );
}

export async function refreshBalancesForItem(itemId: string) {
  const item = await prisma.plaidItem.findUniqueOrThrow({
    where: { id: itemId },
  });

  return withLogContext(
    {
      requestId: ensureRequestId(),
      provider: "plaid",
      tenantId: item.tenantId,
    },
    async () => {
      const startedAt = performance.now();
      logger.info({ itemId: item.id }, "plaid balance refresh started");

      try {
        const accessToken = decryptToken(item.accessTokenEncrypted);
        const response = await getPlaidClient().accountsBalanceGet({ access_token: accessToken });

        const accountsCount = await upsertPlaidAccounts({
          tenantId: item.tenantId,
          itemId: item.id,
          accounts: response.data.accounts,
          captureSnapshot: true,
        });

        await prisma.plaidItem.update({
          where: { id: item.id },
          data: {
            lastBalanceRefreshAt: new Date(),
          },
        });

        logger.info(
          {
            duration: elapsedMs(startedAt),
            itemId: item.id,
            accountsCount,
          },
          "plaid balance refresh completed"
        );
        return { accountsCount };
      } catch (error) {
        logger.error(
          {
            duration: elapsedMs(startedAt),
            itemId: item.id,
            error: safeError(error),
          },
          "plaid balance refresh failed"
        );
        throw error;
      }
    }
  );
}
