import { subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { normalizeMerchant, type DiscoveryCandidate } from "@/lib/cycles/utils";
import type { Frequency } from "@/lib/cycles/types";

const NOMINAL_INTERVAL_DAYS: Record<Frequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  annual: 365,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Count, per normalized merchant, how many of the user's own transactions in the
 * last 6 months match — the "seen N× in your data" corroboration signal. Mirrors
 * the filter used by the local discovery engine.
 */
async function countLocalByMerchant(tenantId: string, now: Date): Promise<Map<string, number>> {
  const sixMonthsAgo = subMonths(now, 6);
  const txs = await prisma.plaidTransaction.findMany({
    where: {
      tenantId,
      removed: false,
      pending: false,
      supersededById: null,
      txnType: "expense",
      date: { gte: sixMonthsAgo, lte: now },
      amount: { gt: 0 },
    },
    select: { name: true, merchantName: true },
  });

  const counts = new Map<string, number>();
  for (const tx of txs) {
    // `||` (not `??`): empty-string merchantName (bank fees) must fall through to name.
    const key = normalizeMerchant(tx.merchantName || tx.name || "");
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Discovery candidates for the cycles panel, sourced from Plaid's recurring
 * streams (stored locally during sync), each annotated with local corroboration
 * ("seen N× in your data"). Returns an empty list when Plaid has no stored
 * streams yet (fresh item / never fetched / Plaid returned nothing) — the panel
 * simply shows nothing until the first sync populates streams.
 *
 * Reads only stored data — never calls Plaid — so it is safe on the render path.
 */
export async function getRecurringCandidates(
  tenantId: string,
  now: Date = new Date()
): Promise<DiscoveryCandidate[]> {
  const streams = await prisma.plaidRecurringStream.findMany({
    where: {
      tenantId,
      direction: "outflow",
      isActive: true,
      frequency: { not: null },
      status: { not: "TOMBSTONED" },
    },
    orderBy: { averageAmount: "desc" },
  });

  if (streams.length === 0) {
    return [];
  }

  // Exclude streams already linked via plaidStreamId (confirmed or dismissed via Plaid path).
  const linked = await prisma.recurringExpense.findMany({
    where: { tenantId, plaidStreamId: { not: null } },
    select: { plaidStreamId: true },
  });
  const usedStreamIds = new Set(linked.map((r) => r.plaidStreamId).filter(Boolean) as string[]);

  // Also exclude streams whose merchant matches an already-confirmed expense by name.
  // Handles expenses confirmed via the old local engine (plaidStreamId=null) so they
  // don't surface as a second candidate and create duplicate committed items.
  const confirmedExpenses = await prisma.recurringExpense.findMany({
    where: { tenantId, confirmed: true, active: true },
    select: { name: true, merchantPattern: true },
  });
  const confirmedMerchantKeys = new Set<string>();
  for (const e of confirmedExpenses) {
    const key = normalizeMerchant(e.merchantPattern ?? e.name ?? "");
    if (key) confirmedMerchantKeys.add(key);
    // Also index the raw name in case merchantPattern differs significantly.
    const nameKey = normalizeMerchant(e.name ?? "");
    if (nameKey) confirmedMerchantKeys.add(nameKey);
  }

  const localCounts = await countLocalByMerchant(tenantId, now);

  const candidates: DiscoveryCandidate[] = [];
  for (const s of streams) {
    if (usedStreamIds.has(s.streamId)) continue;
    // Use `||` not `??`: bank-internal charges (fees, insurance) come back with an
    // empty-string merchantName, so fall through to the statement description.
    const merchantRaw = s.merchantName || s.description || "Unknown";
    const streamKey = normalizeMerchant(merchantRaw);
    if (streamKey && confirmedMerchantKeys.has(streamKey)) continue;
    if (!s.frequency) continue; // guarded by the query, narrows the type
    const frequency = s.frequency as Frequency;

    const amount = Number(s.averageAmount.toString());
    const pattern = streamKey || merchantRaw.toUpperCase();
    const localOccurrences = localCounts.get(normalizeMerchant(merchantRaw)) ?? 0;
    const nextDueDate = s.predictedNextDate
      ? s.predictedNextDate.toISOString().slice(0, 10)
      : null;
    const accrual = Number(computeAccrualPerCycle(amount, frequency).toString());

    candidates.push({
      key: s.streamId,
      source: "plaid",
      merchantPattern: pattern,
      sampleMerchant: merchantRaw,
      suggestedName: titleCase(merchantRaw),
      occurrences: localOccurrences,
      localOccurrences,
      medianIntervalDays: NOMINAL_INTERVAL_DAYS[frequency],
      medianAmount: round2(amount),
      frequency,
      accrualPerCycle: round2(accrual),
      lastSeen: (s.lastDate ?? s.predictedNextDate ?? now).toISOString(),
      plaidStreamId: s.streamId,
      plaidStatus: s.status,
      frequencyRaw: s.frequencyRaw,
      predictedNextDate: s.predictedNextDate ? s.predictedNextDate.toISOString() : null,
      nextDueDate,
    });
  }

  candidates.sort((a, b) => b.accrualPerCycle - a.accrualPerCycle);
  return candidates;
}
