import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recomputeCycleTotals } from "@/lib/cycles/recomputeTotals";
import { computeCycleReservation } from "@/lib/cycles/reservation";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sum depository and credit balances from the last snapshot at or before the
 * end of cycleEndDate (i.e. before midnight of the following day).
 */
async function getBalancesAtCycleEnd(
  tenantId: string,
  cycleEndDate: Date
): Promise<{ chequing: Prisma.Decimal; cc: Prisma.Decimal; hasSnapshot: boolean }> {
  const snapshotCutoff = new Date(cycleEndDate.getTime() + DAY_MS);

  const accounts = await prisma.plaidAccount.findMany({
    where: { tenantId },
    select: { id: true, type: true },
  });

  let chequing = new Prisma.Decimal(0);
  let cc = new Prisma.Decimal(0);
  let hasSnapshot = false;

  for (const acct of accounts) {
    const snap = await prisma.balanceSnapshot.findFirst({
      where: { accountId: acct.id, capturedAt: { lt: snapshotCutoff } },
      orderBy: { capturedAt: "desc" },
      select: { currentBalance: true },
    });
    if (snap?.currentBalance == null) continue;
    hasSnapshot = true;
    if (acct.type === "depository") chequing = chequing.add(snap.currentBalance);
    else if (acct.type === "credit") cc = cc.add(snap.currentBalance);
  }

  return { chequing, cc, hasSnapshot };
}

/**
 * Sum the cumulative-pot reservation for every active confirmed recurring expense
 * that has no matching transaction in the cycle. A recurring expense without a
 * merchant pattern can never match and is always treated as unsettled. Uses the
 * same `computeCycleReservation` as the live view, so the cycle the bill lands in
 * fences the full amount and the cycles before it fence the running pot.
 */
async function getUnsettledAccruals(
  tenantId: string,
  cycle: { id: string; startDate: Date; endDate: Date }
): Promise<Prisma.Decimal> {
  const recurring = await prisma.recurringExpense.findMany({
    where: { tenantId, active: true, confirmed: true },
    select: {
      merchantPattern: true,
      amount: true,
      frequency: true,
      nextDueDate: true,
      accrualPerCycle: true,
      createdAt: true,
    },
  });

  if (!recurring.length) return new Prisma.Decimal(0);

  const txns = await prisma.plaidTransaction.findMany({
    where: { tenantId, cycleId: cycle.id, removed: false, supersededById: null },
    select: { name: true, merchantName: true },
  });

  let total = new Prisma.Decimal(0);
  for (const rec of recurring) {
    const pattern = (rec.merchantPattern ?? "").toUpperCase();
    const matched = pattern
      ? txns.some((tx) =>
          `${tx.name ?? ""} ${tx.merchantName ?? ""}`.toUpperCase().includes(pattern)
        )
      : false;
    if (!matched) total = total.add(computeCycleReservation(rec, cycle).reserved);
  }
  return total;
}

/**
 * Close any cycles that ended before `now`, computing carryover as:
 *
 *   carryover = chequing_balance_at_cycle_end
 *             − cc_balance_at_cycle_end
 *             − unsettled_recurring_accruals
 *
 * Using real balance snapshots avoids the accounting-identity approach which
 * inflated carryover by ignoring unclassified outbound transfers.
 * All closed cycles are recalculated on each call so late syncs stay correct.
 */
export async function closeOverdueCycles(
  tenantId: string,
  now: Date = new Date()
): Promise<number> {
  const overdue = await prisma.payCycle.findMany({
    where: { tenantId, endDate: { lt: now } },
    orderBy: { startDate: "asc" },
    select: { id: true, startDate: true, endDate: true, carryover: true, closedAt: true },
  });

  if (!overdue.length) return 0;

  for (const cycle of overdue) {
    await recomputeCycleTotals(tenantId, cycle.id);
  }

  let closed = 0;

  for (const cycle of overdue) {
    const { chequing, cc, hasSnapshot } = await getBalancesAtCycleEnd(tenantId, cycle.endDate);
    const newCarryover = hasSnapshot
      ? chequing.sub(cc).sub(await getUnsettledAccruals(tenantId, cycle))
      : null;

    const carryoverChanged =
      cycle.carryover == null
        ? newCarryover !== null
        : newCarryover == null || !cycle.carryover.equals(newCarryover);

    if (carryoverChanged || !cycle.closedAt) {
      await prisma.payCycle.update({
        where: { id: cycle.id },
        data: { carryover: { set: newCarryover }, closedAt: cycle.closedAt ?? now },
      });
    }
    if (!cycle.closedAt) closed += 1;
  }

  return closed;
}
