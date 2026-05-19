import { subMonths } from "date-fns";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES, type Frequency } from "@/lib/cycles/types";

export type DiscoveryCandidate = {
  key: string;
  sampleMerchant: string;
  suggestedName: string;
  occurrences: number;
  medianIntervalDays: number;
  medianAmount: number;
  frequency: Frequency;
  accrualPerCycle: number;
  lastSeen: string;
};

const FREQ_BANDS: Record<Frequency, [number, number]> = {
  weekly: [5, 9],
  biweekly: [12, 16],
  monthly: [28, 35],
  annual: [355, 375],
};

/**
 * Normalize a merchant name for grouping: uppercase, collapse whitespace, strip
 * trailing `#nnn` style suffixes, and drop standalone digit tokens (store IDs,
 * card-last-4 echoes, etc.) so two visits to the same merchant cluster.
 */
export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.toUpperCase().trim();
  s = s.replace(/#\s*\d+\b/g, " ");
  s = s.replace(/\b\d{2,}\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function classifyInterval(days: number): Frequency | null {
  for (const f of FREQUENCIES) {
    const [lo, hi] = FREQ_BANDS[f];
    if (days >= lo && days <= hi) return f;
  }
  return null;
}

function numberValue(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export async function discoverRecurringCandidates(
  tenantId: string,
  now: Date = new Date()
): Promise<DiscoveryCandidate[]> {
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
    select: { id: true, name: true, merchantName: true, amount: true, date: true },
    orderBy: { date: "asc" },
  });

  const existing = await prisma.recurringExpense.findMany({
    where: { tenantId },
    select: { merchantPattern: true, active: true, dismissedAt: true, confirmed: true },
  });

  const skipPatterns = existing
    .filter((r) => r.merchantPattern && (r.confirmed || r.dismissedAt))
    .map((r) => r.merchantPattern!.toUpperCase());

  const groups = new Map<string, { sample: string; dates: Date[]; amounts: number[] }>();

  for (const tx of txs) {
    const raw = tx.merchantName ?? tx.name ?? "";
    const key = normalizeMerchant(raw);
    if (!key) continue;
    if (skipPatterns.some((p) => key.includes(p))) continue;

    const bucket = groups.get(key) ?? { sample: raw, dates: [], amounts: [] };
    bucket.dates.push(tx.date);
    bucket.amounts.push(numberValue(tx.amount));
    if (!groups.has(key)) groups.set(key, bucket);
  }

  const candidates: DiscoveryCandidate[] = [];

  for (const [key, group] of groups) {
    if (group.dates.length < 2) continue;

    const intervals: number[] = [];
    for (let i = 1; i < group.dates.length; i += 1) {
      const diff =
        (group.dates[i].getTime() - group.dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(diff);
    }

    const medianInterval = median(intervals);
    const frequency = classifyInterval(medianInterval);
    if (!frequency) continue;

    const medianAmount = median(group.amounts);
    const accrual = Number(computeAccrualPerCycle(medianAmount, frequency).toString());

    candidates.push({
      key,
      sampleMerchant: group.sample,
      suggestedName: titleCase(group.sample),
      occurrences: group.dates.length,
      medianIntervalDays: Math.round(medianInterval * 10) / 10,
      medianAmount: Math.round(medianAmount * 100) / 100,
      frequency,
      accrualPerCycle: Math.round(accrual * 100) / 100,
      lastSeen: group.dates[group.dates.length - 1].toISOString(),
    });
  }

  candidates.sort((a, b) => b.accrualPerCycle - a.accrualPerCycle);
  return candidates;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
