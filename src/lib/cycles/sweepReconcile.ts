import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TX_SOURCE_MANUAL_SWEEP, TX_SOURCE_PLAID } from "@/lib/cycles/types";

const MATCH_WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Look for unmatched manual_sweep transactions in the given cycles and link the
 * most plausible real Plaid savings debit to them. Sets supersededById on the
 * manual row so safe-to-sweep / cycle totals don't double-count.
 *
 * Returns the count of reconciled pairs.
 */
export async function reconcileSweeps(
  tenantId: string,
  cycleIds: string[],
  options: { client?: Client } = {}
) {
  const client = options.client ?? prisma;
  if (!cycleIds.length) return 0;

  const manualRows = await client.plaidTransaction.findMany({
    where: {
      tenantId,
      source: TX_SOURCE_MANUAL_SWEEP,
      removed: false,
      supersededById: null,
      cycleId: { in: cycleIds },
    },
  });

  if (!manualRows.length) return 0;

  let reconciled = 0;
  const claimedReplacementIds = new Set<string>();

  for (const manual of manualRows) {
    const windowStart = new Date(manual.date.getTime() - MATCH_WINDOW_DAYS * DAY_MS);
    const windowEnd = new Date(manual.date.getTime() + MATCH_WINDOW_DAYS * DAY_MS);

    const candidates = await client.plaidTransaction.findMany({
      where: {
        tenantId,
        source: TX_SOURCE_PLAID,
        removed: false,
        txnType: "savings",
        amount: manual.amount,
        date: { gte: windowStart, lte: windowEnd },
        id: { notIn: Array.from(claimedReplacementIds) },
      },
      orderBy: { date: "asc" },
    });

    if (candidates.length !== 1) continue;
    const replacement = candidates[0];
    claimedReplacementIds.add(replacement.id);

    await client.plaidTransaction.update({
      where: { id: manual.id },
      data: { supersededById: replacement.id },
    });
    reconciled += 1;
  }

  return reconciled;
}
