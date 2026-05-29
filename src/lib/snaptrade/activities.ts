import { Prisma, type SnapTradeAccount } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSnapTradeClient, getSnapTradeCredentials } from "@/lib/snaptrade/client";
import { normalizeActivity } from "@/lib/snaptrade/normalize";
import { logger, safeError } from "@/lib/logger";

const BACKFILL_MONTHS = 24;
const OVERLAP_DAYS = 7;
const PAGE_LIMIT = 1000;

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

async function upsertActivity(
  tenantId: string,
  accountId: string,
  normalized: ReturnType<typeof normalizeActivity>,
  raw: unknown
) {
  if (!normalized) return false;
  await prisma.snapTradeActivity.upsert({
    where: { snapTradeActivityId: normalized.snapTradeActivityId },
    update: {
      tenantId,
      accountId,
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
      raw: raw as Prisma.InputJsonValue,
    },
    create: {
      tenantId,
      accountId,
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
      raw: raw as Prisma.InputJsonValue,
    },
  });
  return true;
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

  let savedCount = 0;
  let maxTradeDate: Date | null = account.lastActivityDate ?? null;
  let offset = 0;
  let total: number | null = null;

  try {
    do {
      const response = await client.accountInformation.getAccountActivities({
        accountId: account.snapTradeAccountId,
        userId,
        userSecret,
        startDate: isoDate(start),
        endDate: isoDate(now),
        offset,
        limit: PAGE_LIMIT,
      });

      const page = response.data?.data ?? [];
      if (total === null) {
        total = response.data?.pagination?.total ?? page.length;
      }

      for (const raw of page) {
        const normalized = normalizeActivity(raw);
        if (!normalized) continue;
        const saved = await upsertActivity(tenantId, account.id, normalized, raw);
        if (saved) {
          savedCount += 1;
          if (normalized.tradeDate && (!maxTradeDate || normalized.tradeDate > maxTradeDate)) {
            maxTradeDate = normalized.tradeDate;
          }
        }
      }

      offset += page.length;
      if (page.length < PAGE_LIMIT) break;
    } while (offset < (total ?? 0));
  } catch (error) {
    logger.warn(
      { accountId: account.id, error: safeError(error) },
      "snaptrade activities fetch failed (non-fatal)"
    );
    return 0;
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
