import type { Prisma } from "@prisma/client";

import { getDashboardData } from "@/lib/analytics";
import { getCurrentCycleData } from "@/lib/cycles/getCurrentCycle";

export type CashflowRunwayBill = {
  name: string;
  amount: number;
  accrualPerCycle: number;
  status: string;
  dueDate: string | null;
};

export type CashflowRunwayResult = {
  cashBalance: number;
  thisMonth: {
    income: number;
    spend: number;
    net: number;
  };
  monthlyAverage: {
    months: number;
    income: number;
    spend: number;
    net: number;
  };
  runway: {
    expenseCoverageMonths: number | null;
    netBurnCoverageMonths: number | null;
    basis: string;
  };
  currentCycle: {
    startDate: string | null;
    endDate: string | null;
    daysRemaining: number | null;
    discretionaryRemaining: number | null;
    unsettledAccruals: number | null;
    pendingSpend: number | null;
    upcomingBills: CashflowRunwayBill[];
    hiddenBills: number;
  };
  monthlySeries: {
    month: string;
    income: number;
    spend: number;
    net: number;
  }[];
};

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  const raw = typeof value === "number" ? value : value.toNumber();
  return Math.round(raw * 100) / 100;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-CA")}`;
}

function months(value: number | null): string | null {
  return value == null ? null : `${value.toLocaleString("en-CA")} mo`;
}

export async function fetchCashflowRunway(input: {
  tenantId: string;
  tenantSlug: string;
}): Promise<CashflowRunwayResult> {
  const [dashboard, cycle] = await Promise.all([
    getDashboardData(input.tenantSlug),
    getCurrentCycleData(input.tenantId),
  ]);

  const series = dashboard.monthlyCashflow.map((row) => ({
    month: row.month,
    income: num(row.income),
    spend: num(row.spending),
    net: num(row.net),
  }));
  const monthCount = series.length || 1;
  const avgIncome = num(series.reduce((sum, row) => sum + row.income, 0) / monthCount);
  const avgSpend = num(series.reduce((sum, row) => sum + row.spend, 0) / monthCount);
  const avgNet = num(series.reduce((sum, row) => sum + row.net, 0) / monthCount);
  const cashBalance = num(dashboard.totals.cashBalance);

  const unsettledBills =
    cycle?.committed
      .filter((item) => !item.settled)
      .map((item) => ({
        name: item.name,
        amount: num(item.amount),
        accrualPerCycle: num(item.accrualPerCycle),
        status: item.status,
        dueDate: iso(item.dueDate),
      }))
      .sort((a, b) => {
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return b.accrualPerCycle - a.accrualPerCycle || a.name.localeCompare(b.name);
      }) ?? [];

  const discretionaryRemaining = cycle ? num(cycle.breakdown.discretionaryRemaining) : null;
  const daysRemaining = cycle?.daysRemaining ?? null;

  return {
    cashBalance,
    thisMonth: {
      income: num(dashboard.totals.monthlyIncome),
      spend: num(dashboard.totals.monthlySpend),
      net: num(dashboard.totals.netCashflow),
    },
    monthlyAverage: {
      months: series.length,
      income: avgIncome,
      spend: avgSpend,
      net: avgNet,
    },
    runway: {
      expenseCoverageMonths: ratio(cashBalance, avgSpend),
      netBurnCoverageMonths: avgNet < 0 ? ratio(cashBalance, Math.abs(avgNet)) : null,
      basis:
        "Use expense coverage for burn-rate questions. Net-burn coverage applies only when average net cashflow is negative. Straight-line coverage math, not a forecast.",
    },
    currentCycle: {
      startDate: iso(cycle?.cycle.startDate),
      endDate: iso(cycle?.cycle.endDate),
      daysRemaining,
      discretionaryRemaining,
      unsettledAccruals: cycle ? num(cycle.safeToSweep.components.unsettledAccruals) : null,
      pendingSpend: cycle ? num(cycle.pendingSum) : null,
      upcomingBills: unsettledBills.slice(0, 12),
      hiddenBills: Math.max(0, unsettledBills.length - 12),
    },
    monthlySeries: series,
  };
}

export function serializeCashflowRunway(result: CashflowRunwayResult, currency = "CAD"): string {
  const expenseCoverage = months(result.runway.expenseCoverageMonths) ?? "n/a";
  const netBurnCoverage =
    months(result.runway.netBurnCoverageMonths) ??
    "not applicable because recent average net cashflow is non-negative";
  const lines = [
    "CASHFLOW RUNWAY STATUS - server-computed cash balance, recent cashflow averages, current-cycle obligations, and simple coverage math:",
    `- Cash balance: ${money(result.cashBalance, currency)}`,
    `- This month: income ${money(result.thisMonth.income, currency)}; spend ${money(result.thisMonth.spend, currency)}; net ${money(result.thisMonth.net, currency)}`,
    `- Recent monthly average (${result.monthlyAverage.months} mo): income ${money(result.monthlyAverage.income, currency)}; spend ${money(result.monthlyAverage.spend, currency)}; net ${money(result.monthlyAverage.net, currency)}`,
    `- Coverage: expense coverage if income stopped ${expenseCoverage}; net-burn coverage ${netBurnCoverage}; basis ${result.runway.basis}`,
    `- Runway answer field: for "how long will cash last at current burn rate", answer with expense coverage if income stopped (${expenseCoverage}) and mention net-burn coverage only when it is a number.`,
  ];

  lines.push(
    `- Current pay cycle obligations: ${result.currentCycle.startDate ?? "n/a"} to ${result.currentCycle.endDate ?? "n/a"}; days remaining ${result.currentCycle.daysRemaining ?? "n/a"}; discretionary remaining ${result.currentCycle.discretionaryRemaining == null ? "n/a" : money(result.currentCycle.discretionaryRemaining, currency)}; unsettled accruals ${result.currentCycle.unsettledAccruals == null ? "n/a" : money(result.currentCycle.unsettledAccruals, currency)}; pending spend ${result.currentCycle.pendingSpend == null ? "n/a" : money(result.currentCycle.pendingSpend, currency)}`
  );

  if (result.currentCycle.upcomingBills.length > 0) {
    lines.push("", "UPCOMING / UNSETTLED BILLS THIS CYCLE:");
    for (const bill of result.currentCycle.upcomingBills) {
      lines.push(
        `- ${bill.name}: ${money(bill.amount, currency)}; accrual ${money(bill.accrualPerCycle, currency)}; status ${bill.status}; due ${bill.dueDate ?? "n/a"}`
      );
    }
    if (result.currentCycle.hiddenBills > 0) {
      lines.push(`- ${result.currentCycle.hiddenBills} additional bill(s) hidden by cap.`);
    }
  }

  if (result.monthlySeries.length > 0) {
    lines.push("", "MONTHLY CASHFLOW SERIES:");
    for (const row of result.monthlySeries) {
      lines.push(
        `- ${row.month}: income ${money(row.income, currency)}; spend ${money(row.spend, currency)}; net ${money(row.net, currency)}`
      );
    }
  }

  return lines.join("\n");
}
