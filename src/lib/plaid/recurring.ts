import { Prisma, TenantKind } from "@prisma/client";
import { RecurringTransactionFrequency, type TransactionStream } from "plaid";

import { getPlaidEnv } from "@/lib/env";
import { elapsedMs, logger, safeError } from "@/lib/logger";
import { getPlaidClient } from "@/lib/plaid/client";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/security/token-crypto";
import type { Frequency } from "@/lib/cycles/types";

const DAILY_GATE_MS = 23 * 60 * 60 * 1000;

/**
 * Map Plaid's recurring frequency to our internal cadence. `SEMI_MONTHLY` (twice
 * a month) has no exact local equivalent — we treat it as `monthly` for accrual
 * purposes (the closest anchor-able cadence) and let the caller flag it. `UNKNOWN`
 * is unmappable → null (excluded from candidates).
 */
export function mapPlaidFrequency(raw: RecurringTransactionFrequency): Frequency | null {
  switch (raw) {
    case RecurringTransactionFrequency.Weekly:
      return "weekly";
    case RecurringTransactionFrequency.Biweekly:
      return "biweekly";
    case RecurringTransactionFrequency.SemiMonthly:
    case RecurringTransactionFrequency.Monthly:
      return "monthly";
    case RecurringTransactionFrequency.Annually:
      return "annual";
    default:
      return null;
  }
}

/** Parse a Plaid date-only string ("YYYY-MM-DD") to a UTC Date, or null. */
function parsePlaidDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Stream amounts can be absent; normalise to a positive 2dp number (expense convention). */
function streamAmount(value: number | null | undefined): number {
  if (value == null) return 0;
  return Math.round(Math.abs(value) * 100) / 100;
}

/**
 * Whether this item is due for a recurring-streams refresh. Mirrors
 * `shouldRefreshBalance` in sync.ts: sandbox/demo always refresh; otherwise gate
 * to roughly once per day so the cost-bearing Plaid call stays well under the
 * Recurring free-credit allowance.
 */
export function shouldFetchRecurring(input: {
  tenantKind: TenantKind;
  lastRecurringFetchAt?: Date | null;
}): boolean {
  if (getPlaidEnv() === "sandbox" || input.tenantKind === TenantKind.DEMO) return true;
  if (!input.lastRecurringFetchAt) return true;
  return Date.now() - input.lastRecurringFetchAt.getTime() > DAILY_GATE_MS;
}

async function upsertStream(input: {
  tenantId: string;
  itemId: string;
  direction: "outflow" | "inflow";
  stream: TransactionStream;
  fetchedAt: Date;
}) {
  const { stream } = input;
  const frequency = mapPlaidFrequency(stream.frequency);
  const fields = {
    tenantId: input.tenantId,
    itemId: input.itemId,
    accountId: stream.account_id ?? null,
    direction: input.direction,
    merchantName: stream.merchant_name ?? null,
    description: stream.description ?? null,
    frequencyRaw: String(stream.frequency),
    frequency,
    averageAmount: streamAmount(stream.average_amount?.amount),
    lastAmount: streamAmount(stream.last_amount?.amount),
    lastDate: parsePlaidDate(stream.last_date),
    predictedNextDate: parsePlaidDate(stream.predicted_next_date),
    isActive: stream.is_active,
    status: String(stream.status),
    isUserModified: Boolean(stream.is_user_modified),
    raw: stream as unknown as Prisma.InputJsonValue,
    fetchedAt: input.fetchedAt,
  };

  await prisma.plaidRecurringStream.upsert({
    where: { streamId: stream.stream_id },
    create: { streamId: stream.stream_id, ...fields },
    update: fields,
  });
}

/**
 * Pull Plaid recurring streams for one item and cache them in PlaidRecurringStream.
 * This is the ONLY place that spends a Plaid Recurring credit — callers gate it
 * behind `shouldFetchRecurring` (cron/manual sync) so it never lands on a page
 * render. Stores both outflow (expense) and inflow streams; updates the item's
 * `lastRecurringFetchAt`. Returns the stored counts (or null when the item is
 * unusable). Never throws — recurring is non-fatal to the surrounding sync.
 */
export async function fetchAndStoreRecurring(
  itemId: string,
  opts: { force?: boolean } = {}
): Promise<{ outflow: number; inflow: number } | null> {
  const startedAt = performance.now();
  const item = await prisma.plaidItem.findUnique({
    where: { id: itemId },
    select: { id: true, tenantId: true, accessTokenEncrypted: true },
  });
  if (!item) return null;

  try {
    const accessToken = decryptToken(item.accessTokenEncrypted);
    const client = getPlaidClient();
    // Cost event: log every live spend so a mis-set gate is visible in the logs.
    logger.info({ itemId, force: Boolean(opts.force) }, "plaid recurring fetch started (billable)");

    const response = await client.transactionsRecurringGet({ access_token: accessToken });
    const fetchedAt = new Date();
    const { outflow_streams: outflow, inflow_streams: inflow } = response.data;

    for (const stream of outflow) {
      await upsertStream({ tenantId: item.tenantId, itemId, direction: "outflow", stream, fetchedAt });
    }
    for (const stream of inflow) {
      await upsertStream({ tenantId: item.tenantId, itemId, direction: "inflow", stream, fetchedAt });
    }

    await prisma.plaidItem.update({
      where: { id: itemId },
      data: { lastRecurringFetchAt: fetchedAt },
    });

    logger.info(
      {
        itemId,
        duration: elapsedMs(startedAt),
        outflowCount: outflow.length,
        inflowCount: inflow.length,
        providerRequestId: response.data.request_id,
      },
      "plaid recurring fetch completed"
    );
    return { outflow: outflow.length, inflow: inflow.length };
  } catch (error) {
    logger.error(
      { itemId, duration: elapsedMs(startedAt), error: safeError(error) },
      "plaid recurring fetch failed"
    );
    return null;
  }
}
