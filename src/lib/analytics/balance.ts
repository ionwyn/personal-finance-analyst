import { format, subDays } from "date-fns";
import type { Prisma } from "@prisma/client";

import { delta, numberValue } from "@/lib/analytics/dashboard-helpers";
import type { BalancePoint } from "@/lib/analytics/types";

// `raw` (the full Plaid balance response) is omitted — nothing here reads it.
type SnapshotWithAccount = Prisma.BalanceSnapshotGetPayload<{
  include: { account: true };
  omit: { raw: true };
}>;

export function buildBalanceByDay(snapshots: SnapshotWithAccount[]) {
  const balanceByDay = new Map<string, { date: Date; balance: number }>();
  for (const snapshot of snapshots) {
    const key = format(snapshot.capturedAt, "MMM d");
    const acctType = snapshot.account.type.toLowerCase();
    const isLiability = acctType.includes("credit") || acctType.includes("loan");
    const value = numberValue(snapshot.currentBalance);
    const signed = isLiability ? -Math.abs(value) : value;
    const existing = balanceByDay.get(key);
    balanceByDay.set(key, {
      date: existing?.date ?? snapshot.capturedAt,
      balance: (existing?.balance ?? 0) + signed,
    });
  }
  return balanceByDay;
}

export function buildBalanceHistory(
  balanceByDay: Map<string, { date: Date; balance: number }>,
  investmentsPortfolioCad: number
): BalancePoint[] {
  return [...balanceByDay.entries()].map(([date, info]) => ({
    date,
    balance: info.balance + investmentsPortfolioCad,
  }));
}

export function buildBalanceSpark(history: BalancePoint[]): number[] {
  if (history.length <= 32) return history.map((p) => p.balance);
  const stride = Math.ceil(history.length / 32);
  return history.filter((_, i) => i % stride === 0).map((p) => p.balance);
}

export function computeBalanceDelta(
  history: BalancePoint[],
  balanceByDay: Map<string, { date: Date; balance: number }>,
  investmentsPortfolioCad: number,
  now: Date
): number | null {
  if (history.length < 2) return null;
  const entries = [...balanceByDay.values()];
  const last = entries[entries.length - 1].balance + investmentsPortfolioCad;
  const cutoff = subDays(now, 30);
  const prior = entries.find((e) => e.date <= cutoff);
  if (!prior) return null;
  return delta(last, prior.balance + investmentsPortfolioCad);
}
