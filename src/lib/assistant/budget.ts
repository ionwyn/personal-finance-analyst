import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";

import { getBudgetGoalData, type BudgetProgress } from "@/lib/budgets/getBudgetGoalData";
import type { ScopedFilters } from "@/lib/assistant/query";

type PaceStatus = "over_pace" | "under_pace" | "on_pace";

export type BudgetStatusRow = BudgetProgress & {
  expectedSpendToDate: number;
  paceDelta: number;
  paceStatus: PaceStatus;
  dailySpendToDate: number;
  dailyRoomRemaining: number;
  projectedMonthEnd: number;
};

export type BudgetStatusResult = {
  monthLabel: string;
  asOf: string;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  monthProgressPct: number;
  warnPct: number;
  alarmPct: number;
  rollForward: boolean;
  totalBudgets: number;
  shownBudgets: number;
  matchedCategory: string | null;
  availableCategories: string[];
  totalCap: number;
  totalSpent: number;
  totalRemaining: number;
  totalPct: number;
  totalExpectedSpendToDate: number;
  totalPaceDelta: number;
  totalProjectedMonthEnd: number;
  overBudgetCount: number;
  warnBudgetCount: number;
  overPaceCount: number;
  rows: BudgetStatusRow[];
};

const CATEGORY_STOPWORDS = new Set(["and", "the", "of", "or", "a", "to", "budget"]);
const GENERIC_BUDGET_SCOPES = new Set([
  "all",
  "all budget",
  "all budgets",
  "budget",
  "budgets",
  "budget category",
  "budget categories",
  "caps",
  "each",
  "each budget",
  "every",
  "every budget",
  "overall",
  "over pace",
  "over-pace",
  "over_pace",
  "remaining",
  "remaining room",
]);

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-CA")}`;
}

function signedMoney(n: number, currency: string): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${money(Math.abs(n), currency)}`;
}

function pct(n: number): string {
  return `${roundPct(n).toLocaleString("en-CA")}%`;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token && !CATEGORY_STOPWORDS.has(token))
  );
}

function categoryMatches(budget: BudgetProgress, term: string): boolean {
  const wanted = tokenize(term);
  if (wanted.size === 0) return true;

  const raw = budget.categoryPrimary.toLowerCase();
  const label = budget.categoryLabel.toLowerCase();
  const normalizedTerm = term.toLowerCase().trim();
  if (raw === normalizedTerm || label === normalizedTerm) return true;
  if (raw.includes(normalizedTerm) || label.includes(normalizedTerm)) return true;

  const available = tokenize(`${budget.categoryPrimary} ${budget.categoryLabel}`);
  return [...wanted].some((token) => available.has(token));
}

function statusRank(row: BudgetStatusRow): number {
  if (row.status === "over") return 0;
  if (row.paceStatus === "over_pace") return 1;
  if (row.status === "warn") return 2;
  return 3;
}

function normalizeBudgetCategoryScope(filters: ScopedFilters): string | null {
  const raw = filters.category?.trim() || filters.q?.trim() || "";
  if (!raw) return null;

  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, " ").replaceAll(/\s+/g, " ").trim();
  return GENERIC_BUDGET_SCOPES.has(normalized) ? null : raw;
}

function buildRow(
  budget: BudgetProgress,
  daysElapsed: number,
  daysInMonth: number,
  daysRemaining: number
): BudgetStatusRow {
  const expectedSpendToDate = roundMoney(budget.cap * (daysElapsed / daysInMonth));
  const paceDelta = roundMoney(budget.spent - expectedSpendToDate);
  const dailySpendToDate = roundMoney(budget.spent / daysElapsed);
  const projectedMonthEnd = roundMoney(dailySpendToDate * daysInMonth);
  const dailyRoomRemaining = daysRemaining > 0 ? roundMoney(budget.remaining / daysRemaining) : 0;
  const paceStatus: PaceStatus =
    Math.abs(paceDelta) < 0.01 ? "on_pace" : paceDelta > 0 ? "over_pace" : "under_pace";

  return {
    ...budget,
    cap: roundMoney(budget.cap),
    spent: roundMoney(budget.spent),
    remaining: roundMoney(budget.remaining),
    pct: roundPct(budget.pct),
    expectedSpendToDate,
    paceDelta,
    paceStatus,
    dailySpendToDate,
    dailyRoomRemaining,
    projectedMonthEnd,
  };
}

export async function fetchBudgetStatus(
  tenantId: string,
  filters: ScopedFilters = {},
  now: Date = new Date()
): Promise<BudgetStatusResult> {
  const data = await getBudgetGoalData(tenantId, now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysElapsed = differenceInCalendarDays(now, monthStart) + 1;
  const daysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1;
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
  const matchedCategory = normalizeBudgetCategoryScope(filters);

  const rows = data.budgets
    .map((budget) => buildRow(budget, daysElapsed, daysInMonth, daysRemaining))
    .filter((budget) => (matchedCategory ? categoryMatches(budget, matchedCategory) : true))
    .sort(
      (a, b) =>
        statusRank(a) - statusRank(b) ||
        b.paceDelta - a.paceDelta ||
        b.pct - a.pct ||
        a.categoryLabel.localeCompare(b.categoryLabel)
    );

  const totalCap = roundMoney(rows.reduce((sum, row) => sum + row.cap, 0));
  const totalSpent = roundMoney(rows.reduce((sum, row) => sum + row.spent, 0));
  const totalExpectedSpendToDate = roundMoney(
    rows.reduce((sum, row) => sum + row.expectedSpendToDate, 0)
  );

  return {
    monthLabel: data.monthLabel,
    asOf: format(now, "yyyy-MM-dd"),
    daysElapsed,
    daysInMonth,
    daysRemaining,
    monthProgressPct: roundPct((daysElapsed / daysInMonth) * 100),
    warnPct: data.warnPct,
    alarmPct: data.alarmPct,
    rollForward: data.rollForward,
    totalBudgets: data.budgets.length,
    shownBudgets: rows.length,
    matchedCategory,
    availableCategories: data.budgets.map((budget) => budget.categoryLabel).sort(),
    totalCap,
    totalSpent,
    totalRemaining: roundMoney(rows.reduce((sum, row) => sum + row.remaining, 0)),
    totalPct: totalCap > 0 ? roundPct((totalSpent / totalCap) * 100) : 0,
    totalExpectedSpendToDate,
    totalPaceDelta: roundMoney(totalSpent - totalExpectedSpendToDate),
    totalProjectedMonthEnd:
      daysElapsed > 0 ? roundMoney((totalSpent / daysElapsed) * daysInMonth) : 0,
    overBudgetCount: rows.filter((row) => row.status === "over").length,
    warnBudgetCount: rows.filter((row) => row.status === "warn").length,
    overPaceCount: rows.filter((row) => row.paceStatus === "over_pace").length,
    rows,
  };
}

export function serializeBudgetStatus(result: BudgetStatusResult, currency = "CAD"): string {
  const label = result.matchedCategory ? `category ${result.matchedCategory}` : "all budgets";
  if (result.rows.length === 0) {
    const categories =
      result.availableCategories.length > 0
        ? ` Active budget categories: ${result.availableCategories.join(", ")}.`
        : "";
    return `BUDGET STATUS for ${label}: none found.${categories}`;
  }

  const lines = [
    `BUDGET STATUS for ${label} - server-computed monthly budget caps, spend-to-date, remaining room, burn rate, and pace by category:`,
    `- Month: ${result.monthLabel}; as of ${result.asOf}; day ${result.daysElapsed} of ${result.daysInMonth} (${pct(result.monthProgressPct)} elapsed); ${result.daysRemaining} day${result.daysRemaining === 1 ? "" : "s"} remaining`,
    `- Totals shown: cap ${money(result.totalCap, currency)}; spent ${money(result.totalSpent, currency)}; remaining ${money(result.totalRemaining, currency)}; used ${pct(result.totalPct)}; expected by now ${money(result.totalExpectedSpendToDate, currency)}; pace ${signedMoney(result.totalPaceDelta, currency)}; projected month-end ${money(result.totalProjectedMonthEnd, currency)}`,
    `- Status counts shown: ${result.overBudgetCount} over budget; ${result.warnBudgetCount} at warning; ${result.overPaceCount} over pace; warning threshold ${result.warnPct}%; alarm threshold ${result.alarmPct}%`,
    "",
    "CATEGORY BUDGETS:",
  ];

  for (const row of result.rows) {
    lines.push(
      `- ${row.categoryLabel}: cap ${money(row.cap, currency)}; spent ${money(row.spent, currency)}; remaining ${money(row.remaining, currency)}; used ${pct(row.pct)}; status ${row.status}; burn rate ${money(row.dailySpendToDate, currency)}/day; remaining daily room ${money(row.dailyRoomRemaining, currency)}/day; expected by now ${money(row.expectedSpendToDate, currency)}; pace ${signedMoney(row.paceDelta, currency)} (${row.paceStatus}); projected month-end ${money(row.projectedMonthEnd, currency)}`
    );
  }

  return lines.join("\n");
}
