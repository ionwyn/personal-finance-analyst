import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { closeOverdueCycles } from "@/lib/cycles/close";
import { computeSafeToSweep, type SafeToSweepResult } from "@/lib/cycles/safeToSweep";
import { ensureCycleForDate } from "@/lib/cycles/generate";
import {
  findPreviousCycleId,
  getSpendingBreakdown,
  type SpendingBreakdownData,
} from "@/lib/cycles/getSpendingBreakdown";
import { SPENDING_FILTER } from "@/lib/spending/classify";

export type CommittedStatus = "debited" | "accrued" | "upcoming" | "paid";

export type CommittedItem = {
  id: string;
  name: string;
  amount: Prisma.Decimal;
  accrualPerCycle: Prisma.Decimal;
  frequency: string;
  status: CommittedStatus;
  /** True when the item no longer accrues this cycle: auto-debited or manually settled. */
  settled: boolean;
  /** The scheduled date this expense lands in the cycle (from anchorDate), if any. */
  dueDate: Date | null;
  /** For a manual "Paid" settlement: the recorded method (e.g. "e-transfer", "cash"). */
  settledMethod: string | null;
  /** The transaction covering this item: auto-matched, manually linked, or null (cash/cheque). */
  matchedTransactionId: string | null;
  /** Whether an auto-match merchantPattern is already configured (drives the rule nudge). */
  hasPattern: boolean;
};

export type CurrentCycleData = {
  cycle: {
    id: string;
    startDate: Date;
    endDate: Date;
    incomeReceived: Prisma.Decimal | null;
    fixedSavingsPull: Prisma.Decimal | null;
    sweptAmount: Prisma.Decimal | null;
    creditCardPaymentDate: Date | null;
    notes: string | null;
  };
  daysRemaining: number;
  committed: CommittedItem[];
  committedTotalAccrued: Prisma.Decimal;
  spentSoFar: Prisma.Decimal;
  pendingSum: Prisma.Decimal;
  pendingCount: number;
  lastCycleCarryover: Prisma.Decimal | null;
  chequingBalance: Prisma.Decimal;
  creditCardBalance: Prisma.Decimal;
  sweepBuffer: Prisma.Decimal;
  safeToSweep: SafeToSweepResult;
  settingsConfigured: boolean;
  breakdown: SpendingBreakdownData;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dayOfMonthInCycle(
  start: Date,
  end: Date,
  dayOfMonth: number | null | undefined
): Date | null {
  if (!dayOfMonth) return null;
  const startYM = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endYM = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (
    let cursor = startYM;
    cursor <= endYM;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const lastOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(dayOfMonth, lastOfMonth);
    const candidate = new Date(Date.UTC(year, month, day));
    if (candidate >= startOfUtcDay(start) && candidate <= startOfUtcDay(end)) {
      return candidate;
    }
  }
  return null;
}

export async function getCurrentCycleData(
  tenantId: string,
  now: Date = new Date()
): Promise<CurrentCycleData | null> {
  await closeOverdueCycles(tenantId, now);

  const cycle = await ensureCycleForDate(tenantId, now);

  const settings = await prisma.userSettings.findUnique({ where: { tenantId } });
  const settingsConfigured = Boolean(settings?.lastPaycheckDate);

  const accounts = await prisma.plaidAccount.findMany({
    where: { tenantId },
    select: { id: true, type: true, subtype: true, currentBalance: true },
  });

  let chequingBalance = new Prisma.Decimal(0);
  let creditCardBalance = new Prisma.Decimal(0);
  for (const acct of accounts) {
    const bal = acct.currentBalance ?? new Prisma.Decimal(0);
    if (acct.type === "depository") {
      chequingBalance = chequingBalance.add(bal);
    } else if (acct.type === "credit") {
      creditCardBalance = creditCardBalance.add(bal);
    }
  }

  const ccDate = dayOfMonthInCycle(
    cycle.startDate,
    cycle.endDate,
    settings?.ccPaymentDayOfMonth ?? null
  );

  const expenseAgg = await prisma.plaidTransaction.aggregate({
    where: { ...SPENDING_FILTER, tenantId, cycleId: cycle.id },
    _sum: { amount: true },
  });
  const expenseAll = expenseAgg._sum.amount ?? new Prisma.Decimal(0);

  const pendingAgg = await prisma.plaidTransaction.aggregate({
    where: { ...SPENDING_FILTER, tenantId, cycleId: cycle.id, pending: true },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const pendingSum = pendingAgg._sum.amount ?? new Prisma.Decimal(0);
  const pendingCount = pendingAgg._count._all;

  const recurring = await prisma.recurringExpense.findMany({
    where: { tenantId, active: true, confirmed: true },
    select: {
      id: true,
      name: true,
      merchantPattern: true,
      amount: true,
      accrualPerCycle: true,
      frequency: true,
      anchorDate: true,
    },
  });

  const cycleMatches = await prisma.plaidTransaction.findMany({
    where: { ...SPENDING_FILTER, tenantId, cycleId: cycle.id },
    select: { id: true, merchantName: true, name: true },
  });

  // Manual settlements recorded for this cycle (one per recurring expense).
  // A row means the user settled it: linked to a transaction or "Paid" (cash/cheque).
  const settlements = await prisma.committedSettlement.findMany({
    where: { tenantId, cycleId: cycle.id },
    select: { recurringExpenseId: true, transactionId: true, method: true },
  });
  const settlementByExpense = new Map(settlements.map((s) => [s.recurringExpenseId, s]));

  const today = startOfUtcDay(now);
  const cycleEnd = startOfUtcDay(cycle.endDate);

  const committed: CommittedItem[] = recurring.map((rec) => {
    const anchorOccurrence = dayOfMonthInCycle(cycle.startDate, cycle.endDate, rec.anchorDate);
    const hasPattern = Boolean(rec.merchantPattern);
    const manual = settlementByExpense.get(rec.id);

    // A manual settlement always wins: the user has asserted this is handled.
    if (manual) {
      return {
        id: rec.id,
        name: rec.name,
        amount: rec.amount,
        accrualPerCycle: rec.accrualPerCycle,
        frequency: rec.frequency,
        status: "paid",
        settled: true,
        dueDate: anchorOccurrence,
        settledMethod: manual.method,
        matchedTransactionId: manual.transactionId,
        hasPattern,
      };
    }

    const pattern = (rec.merchantPattern ?? "").toUpperCase();
    let matched: { id: string } | null = null;
    if (pattern) {
      matched =
        cycleMatches.find((tx) => {
          const merchant = `${tx.name ?? ""} ${tx.merchantName ?? ""}`.toUpperCase();
          return merchant.includes(pattern);
        }) ?? null;
    }

    let status: CommittedStatus;
    if (matched) status = "debited";
    else if (anchorOccurrence && anchorOccurrence > today) status = "upcoming";
    else status = "accrued";

    return {
      id: rec.id,
      name: rec.name,
      amount: rec.amount,
      accrualPerCycle: rec.accrualPerCycle,
      frequency: rec.frequency,
      status,
      settled: status === "debited",
      dueDate: anchorOccurrence,
      settledMethod: null,
      matchedTransactionId: matched?.id ?? null,
      hasPattern,
    };
  });

  const unsettledAccruals = committed
    .filter((c) => !c.settled)
    .reduce((sum, c) => sum.add(c.accrualPerCycle), new Prisma.Decimal(0));
  const committedTotalAccrued = committed.reduce(
    (sum, c) => sum.add(c.accrualPerCycle),
    new Prisma.Decimal(0)
  );

  const sweepBuffer = settings?.sweepBuffer ?? new Prisma.Decimal(100);

  const lastClosedCycle = await prisma.payCycle.findFirst({
    where: { tenantId, endDate: { lt: cycle.startDate }, closedAt: { not: null } },
    orderBy: { startDate: "desc" },
    select: { carryover: true },
  });
  const lastCycleCarryover = lastClosedCycle?.carryover ?? null;

  const safeToSweep = computeSafeToSweep({
    chequingBalance,
    pendingExpenses: pendingSum,
    unsettledAccruals,
    creditCardBalance,
    sweepBuffer,
  });

  const daysRemaining = Math.max(0, Math.ceil((cycleEnd.getTime() - today.getTime()) / DAY_MS) + 1);

  const incomeReceivedNum = cycle.incomeReceived ? Number(cycle.incomeReceived.toString()) : 0;
  const fixedSavingsPullNum = cycle.fixedSavingsPull
    ? Number(cycle.fixedSavingsPull.toString())
    : 0;
  const committedAccrualsNum = Number(committedTotalAccrued.toString());
  const discretionaryBudget = Math.max(
    0,
    incomeReceivedNum - fixedSavingsPullNum - committedAccrualsNum
  );

  const previousCycleId = await findPreviousCycleId(tenantId, cycle.startDate);
  const breakdown = await getSpendingBreakdown(
    tenantId,
    cycle.id,
    previousCycleId,
    discretionaryBudget
  );

  return {
    cycle: {
      id: cycle.id,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      incomeReceived: cycle.incomeReceived,
      fixedSavingsPull: cycle.fixedSavingsPull,
      sweptAmount: cycle.sweptAmount,
      creditCardPaymentDate: ccDate,
      notes: cycle.notes,
    },
    daysRemaining,
    committed,
    committedTotalAccrued,
    spentSoFar: expenseAll,
    pendingSum,
    pendingCount,
    lastCycleCarryover,
    chequingBalance,
    creditCardBalance,
    sweepBuffer,
    safeToSweep,
    settingsConfigured,
    breakdown,
  };
}
