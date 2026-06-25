import { format } from "date-fns";
import type { Prisma } from "@prisma/client";

import { getCurrentCycleData, type CurrentCycleData } from "@/lib/cycles/getCurrentCycle";

export type CycleStatusCommittedItem = {
  name: string;
  amount: number;
  accrualPerCycle: number;
  frequency: string;
  status: string;
  settled: boolean;
  dueDate: string | null;
  settledMethod: string | null;
  hasPattern: boolean;
};

export type CycleStatusResult = {
  asOf: string;
  settingsConfigured: boolean;
  cycle: {
    startDate: string;
    endDate: string;
    daysRemaining: number;
    incomeReceived: number;
    fixedSavingsPull: number;
    sweptAmount: number;
    creditCardPaymentDate: string | null;
  };
  balances: {
    chequing: number;
    creditCard: number;
  };
  safeToSweep: {
    amount: number;
    rawAmount: number;
    overCommitted: boolean;
    sweepBuffer: number;
    pendingExpenses: number;
    unsettledAccruals: number;
    creditCardBalance: number;
  };
  pending: {
    sum: number;
    count: number;
  };
  committed: {
    totalAccrued: number;
    totalItems: number;
    settledCount: number;
    unsettledCount: number;
    upcomingCount: number;
    accruedCount: number;
    debitedCount: number;
    paidCount: number;
    shownItems: CycleStatusCommittedItem[];
    hiddenItems: number;
  };
  discretionary: {
    budget: number;
    spent: number;
    remaining: number;
    dailyRoom: number;
  };
  topCategories: {
    category: string;
    amount: number;
    pct: number;
    delta: number | null;
  }[];
} | null;

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  const raw = typeof value === "number" ? value : value.toNumber();
  return Math.round(raw * 100) / 100;
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-CA")}`;
}

function signedMoney(n: number, currency: string): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${money(Math.abs(n), currency)}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100) / 100}%`;
}

function sortCommittedItems(data: CurrentCycleData): CycleStatusCommittedItem[] {
  const rank = new Map([
    ["accrued", 0],
    ["upcoming", 1],
    ["debited", 2],
    ["paid", 3],
  ]);

  return data.committed
    .map((item) => ({
      name: item.name,
      amount: num(item.amount),
      accrualPerCycle: num(item.accrualPerCycle),
      frequency: item.frequency,
      status: item.status,
      settled: item.settled,
      dueDate: iso(item.dueDate),
      settledMethod: item.settledMethod,
      hasPattern: item.hasPattern,
    }))
    .sort((a, b) => {
      const statusDelta = (rank.get(a.status) ?? 9) - (rank.get(b.status) ?? 9);
      if (statusDelta !== 0) return statusDelta;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return b.accrualPerCycle - a.accrualPerCycle || a.name.localeCompare(b.name);
    });
}

export async function fetchCycleStatus(
  tenantId: string,
  now: Date = new Date()
): Promise<CycleStatusResult> {
  const data = await getCurrentCycleData(tenantId, now);
  if (!data) return null;

  const committedItems = sortCommittedItems(data);
  const shownItems = committedItems.slice(0, 12);
  const daysRemaining = data.daysRemaining;
  const discretionaryRemaining = num(data.breakdown.discretionaryRemaining);

  return {
    asOf: format(now, "yyyy-MM-dd"),
    settingsConfigured: data.settingsConfigured,
    cycle: {
      startDate: iso(data.cycle.startDate) ?? "",
      endDate: iso(data.cycle.endDate) ?? "",
      daysRemaining,
      incomeReceived: num(data.cycle.incomeReceived),
      fixedSavingsPull: num(data.cycle.fixedSavingsPull),
      sweptAmount: num(data.cycle.sweptAmount),
      creditCardPaymentDate: iso(data.cycle.creditCardPaymentDate),
    },
    balances: {
      chequing: num(data.chequingBalance),
      creditCard: num(data.creditCardBalance),
    },
    safeToSweep: {
      amount: num(data.safeToSweep.amount),
      rawAmount: num(data.safeToSweep.rawAmount),
      overCommitted: data.safeToSweep.overCommitted,
      sweepBuffer: num(data.safeToSweep.components.sweepBuffer),
      pendingExpenses: num(data.safeToSweep.components.pendingExpenses),
      unsettledAccruals: num(data.safeToSweep.components.unsettledAccruals),
      creditCardBalance: num(data.safeToSweep.components.creditCardBalance),
    },
    pending: {
      sum: num(data.pendingSum),
      count: data.pendingCount,
    },
    committed: {
      totalAccrued: num(data.committedTotalAccrued),
      totalItems: committedItems.length,
      settledCount: committedItems.filter((item) => item.settled).length,
      unsettledCount: committedItems.filter((item) => !item.settled).length,
      upcomingCount: committedItems.filter((item) => item.status === "upcoming").length,
      accruedCount: committedItems.filter((item) => item.status === "accrued").length,
      debitedCount: committedItems.filter((item) => item.status === "debited").length,
      paidCount: committedItems.filter((item) => item.status === "paid").length,
      shownItems,
      hiddenItems: Math.max(0, committedItems.length - shownItems.length),
    },
    discretionary: {
      budget: num(data.breakdown.discretionaryBudget),
      spent: num(data.breakdown.discretionarySpent),
      remaining: discretionaryRemaining,
      dailyRoom: daysRemaining > 0 ? num(discretionaryRemaining / daysRemaining) : 0,
    },
    topCategories: data.breakdown.rows.slice(0, 5).map((row) => ({
      category: row.category,
      amount: num(row.amount),
      pct: Math.round(row.pct * 100) / 100,
      delta: row.delta == null ? null : num(row.delta),
    })),
  };
}

export function serializeCycleStatus(result: CycleStatusResult, currency = "CAD"): string {
  if (!result) {
    return "PAY CYCLE STATUS: none found. The assistant needs an active pay cycle before it can answer pay-cycle questions.";
  }

  const lines = [
    "PAY CYCLE STATUS - server-computed pay-cycle dates, committed expenses, safe-to-sweep, pending spend, and discretionary room:",
    `- As of ${result.asOf}; current cycle ${result.cycle.startDate} to ${result.cycle.endDate}; ${result.cycle.daysRemaining} day${result.cycle.daysRemaining === 1 ? "" : "s"} remaining`,
    `- Settings configured: ${result.settingsConfigured ? "yes" : "no"}`,
    `- Cycle income received ${money(result.cycle.incomeReceived, currency)}; fixed savings pull ${money(result.cycle.fixedSavingsPull, currency)}; already swept ${money(result.cycle.sweptAmount, currency)}; credit-card payment date ${result.cycle.creditCardPaymentDate ?? "not set"}`,
    `- Balances used for sweep math: chequing ${money(result.balances.chequing, currency)}; credit card ${money(result.balances.creditCard, currency)}`,
    `- Safe to sweep: suggested ${money(result.safeToSweep.amount, currency)}; raw room ${signedMoney(result.safeToSweep.rawAmount, currency)}; over-committed ${result.safeToSweep.overCommitted ? "yes" : "no"}; buffer ${money(result.safeToSweep.sweepBuffer, currency)}; pending expenses ${money(result.safeToSweep.pendingExpenses, currency)}; unsettled accruals ${money(result.safeToSweep.unsettledAccruals, currency)}; credit-card balance ${money(result.safeToSweep.creditCardBalance, currency)}`,
    `- Pending transactions: ${result.pending.count}; pending spend ${money(result.pending.sum, currency)}`,
    `- Committed expenses: ${result.committed.totalItems} total; ${result.committed.unsettledCount} unsettled; ${result.committed.settledCount} settled; ${result.committed.upcomingCount} upcoming; ${result.committed.accruedCount} accrued; ${result.committed.debitedCount} debited; ${result.committed.paidCount} manually paid; total accrual ${money(result.committed.totalAccrued, currency)}`,
    `- Discretionary: budget ${money(result.discretionary.budget, currency)}; spent ${money(result.discretionary.spent, currency)}; remaining ${money(result.discretionary.remaining, currency)}; daily room ${money(result.discretionary.dailyRoom, currency)}/day`,
  ];

  const unsettledItems = result.committed.shownItems.filter((item) => !item.settled);
  const settledItems = result.committed.shownItems.filter((item) => item.settled);

  if (unsettledItems.length > 0) {
    lines.push("", "UNSETTLED COMMITTED EXPENSES (bills left this cycle, capped):");
    for (const item of unsettledItems) {
      const due = item.dueDate ? `due ${item.dueDate}` : "no due date";
      lines.push(
        `- ${item.name}: ${money(item.amount, currency)}; accrual ${money(item.accrualPerCycle, currency)}; ${item.frequency}; status ${item.status}; ${due}; auto-match pattern ${item.hasPattern ? "yes" : "no"}`
      );
    }
  }

  if (settledItems.length > 0) {
    lines.push("", "SETTLED COMMITTED EXPENSES (already handled this cycle, capped):");
    for (const item of settledItems) {
      const due = item.dueDate ? `due ${item.dueDate}` : "no due date";
      const method = item.settledMethod ? `; settled by ${item.settledMethod}` : "";
      lines.push(
        `- ${item.name}: ${money(item.amount, currency)}; accrual ${money(item.accrualPerCycle, currency)}; ${item.frequency}; status ${item.status}; ${due}; auto-match pattern ${item.hasPattern ? "yes" : "no"}${method}`
      );
    }
  }

  if (result.committed.hiddenItems > 0) {
    lines.push(`- ${result.committed.hiddenItems} additional committed expense(s) hidden by cap.`);
  }

  if (result.topCategories.length > 0) {
    lines.push("", "PAY-CYCLE SPENDING CATEGORIES:");
    for (const row of result.topCategories) {
      const delta = row.delta == null ? "no previous-cycle delta" : `delta ${signedMoney(row.delta, currency)}`;
      lines.push(
        `- ${row.category}: ${money(row.amount, currency)}; ${pct(row.pct)} of cycle spending; ${delta}`
      );
    }
  }

  return lines.join("\n");
}
