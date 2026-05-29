import { Prisma, type SnapTradeAccount } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSnapTradeClient, getSnapTradeCredentials } from "@/lib/snaptrade/client";
import { normalizeActivity } from "@/lib/snaptrade/normalize";
import { logger, safeError } from "@/lib/logger";

const BACKFILL_MONTHS = 24;
const OVERLAP_DAYS = 7;

function decimal(value: number | null | undefined) {
  return value == null ? null : new Prisma.Decimal(value);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function backfillStart(now: Date) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - BACKFILL_MONTHS);
  return d;
}

function incrementalStart(lastActivityDate: Date) {
  const d = new Date(lastActivityDate);
  d.setDate(d.getDate() - OVERLAP_DAYS);
  return d;
}

export async function syncActivitiesForAccount(input: {
  tenantId: string;
  account: SnapTradeAccount;
}): Promise<number> {
  const { tenantId, account } = input;
  const client = getSnapTradeClient();
  const { userId, userSecret } = getSnapTradeCredentials();

  const now = new Date();
  const start =
    account.activitiesBackfilledAt && account.lastActivityDate
      ? incrementalStart(account.lastActivityDate)
      : backfillStart(now);

  let response;
  try {
    response = await client.transactionsAndReporting.getActivities({
      userId,
      userSecret,
      accounts: account.snapTradeAccountId,
      startDate: isoDate(start),
      endDate: isoDate(now),
    });
  } catch (error) {
    logger.warn(
      { accountId: account.id, error: safeError(error) },
      "snaptrade activities fetch failed (non-fatal)"
    );
    return 0;
  }

  const activities = response.data ?? [];
  let savedCount = 0;
  let maxTradeDate: Date | null = account.lastActivityDate ?? null;

  for (const raw of activities) {
    const normalized = normalizeActivity(raw);
    if (!normalized) continue;

    await prisma.snapTradeActivity.upsert({
      where: { snapTradeActivityId: normalized.snapTradeActivityId },
      update: {
        tenantId,
        accountId: account.id,
        type: normalized.type,
        symbol: normalized.symbol,
        description: normalized.description,
        units: decimal(normalized.units),
        price: decimal(normalized.price),
        amount: decimal(normalized.amount),
        fee: decimal(normalized.fee),
        currency: normalized.currency,
        fxRate: decimal(normalized.fxRate),
        tradeDate: normalized.tradeDate,
        settlementDate: normalized.settlementDate,
        externalReferenceId: normalized.externalReferenceId,
        institution: normalized.institution,
        raw: raw as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        accountId: account.id,
        snapTradeActivityId: normalized.snapTradeActivityId,
        type: normalized.type,
        symbol: normalized.symbol,
        description: normalized.description,
        units: decimal(normalized.units),
        price: decimal(normalized.price),
        amount: decimal(normalized.amount),
        fee: decimal(normalized.fee),
        currency: normalized.currency,
        fxRate: decimal(normalized.fxRate),
        tradeDate: normalized.tradeDate,
        settlementDate: normalized.settlementDate,
        externalReferenceId: normalized.externalReferenceId,
        institution: normalized.institution,
        raw: raw as unknown as Prisma.InputJsonValue,
      },
    });

    savedCount += 1;
    if (normalized.tradeDate && (!maxTradeDate || normalized.tradeDate > maxTradeDate)) {
      maxTradeDate = normalized.tradeDate;
    }
  }

  await prisma.snapTradeAccount.update({
    where: { id: account.id },
    data: {
      activitiesBackfilledAt: account.activitiesBackfilledAt ?? now,
      lastActivityDate: maxTradeDate,
    },
  });

  return savedCount;
}
