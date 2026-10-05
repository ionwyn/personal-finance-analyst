import { format } from "date-fns";

import { getBudgetGoalData, type GoalProgress } from "@/lib/budgets/getBudgetGoalData";
import type { ScopedFilters } from "@/lib/assistant/query";

export type SavingsGoalStatusRow = GoalProgress & {
  paceNeededMonthly: number | null;
  daysUntilTarget: number | null;
};

export type SavingsGoalStatusResult = {
  asOf: string;
  scope: string | null;
  totalGoals: number;
  shownGoals: number;
  reachedCount: number;
  totalTarget: number;
  totalSaved: number;
  totalRemaining: number;
  rows: SavingsGoalStatusRow[];
};

const GENERIC_GOAL_SCOPES = new Set([
  "goal",
  "goals",
  "my goal",
  "my goals",
  "my savings goal",
  "my savings goals",
  "savings goal",
  "savings goals",
  "active goals",
  "active savings goals",
]);

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-CA")}`;
}

function pct(value: number) {
  return `${round(value).toLocaleString("en-CA")}%`;
}

function normalizeScope(filters: ScopedFilters): string | null {
  const raw = filters.q?.trim() || filters.category?.trim() || "";
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, " ").replaceAll(/\s+/g, " ").trim();
  if (!normalized || GENERIC_GOAL_SCOPES.has(normalized)) return null;
  return raw;
}

function matchesGoal(goal: GoalProgress, scope: string | null) {
  if (!scope) return true;
  const haystack = `${goal.name} ${goal.destinationLabel ?? ""}`.toLowerCase();
  return haystack.includes(scope.toLowerCase());
}

function daysUntil(targetDate: string | null, now: Date): number | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (!Number.isFinite(target.getTime())) return null;
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

function paceNeededMonthly(goal: GoalProgress, now: Date): number | null {
  const days = daysUntil(goal.targetDate, now);
  if (days == null || days === 0) return null;
  return round(goal.remaining / Math.max(days / 30.4375, 1 / 30.4375));
}

export async function fetchSavingsGoalStatus(
  tenantId: string,
  filters: ScopedFilters = {},
  now: Date = new Date()
): Promise<SavingsGoalStatusResult> {
  const data = await getBudgetGoalData(tenantId, now);
  const scope = normalizeScope(filters);
  const rows = data.goals
    .filter((goal) => matchesGoal(goal, scope))
    .map((goal) => ({
      ...goal,
      target: round(goal.target),
      saved: round(goal.saved),
      remaining: round(goal.remaining),
      pct: round(goal.pct),
      manualAmount: round(goal.manualAmount),
      paceNeededMonthly: paceNeededMonthly(goal, now),
      daysUntilTarget: daysUntil(goal.targetDate, now),
    }))
    .sort((a, b) => Number(a.reached) - Number(b.reached) || b.remaining - a.remaining);

  return {
    asOf: format(now, "yyyy-MM-dd"),
    scope,
    totalGoals: data.goals.length,
    shownGoals: rows.length,
    reachedCount: rows.filter((row) => row.reached).length,
    totalTarget: round(rows.reduce((sum, row) => sum + row.target, 0)),
    totalSaved: round(rows.reduce((sum, row) => sum + row.saved, 0)),
    totalRemaining: round(rows.reduce((sum, row) => sum + row.remaining, 0)),
    rows,
  };
}

export function serializeSavingsGoalStatus(
  result: SavingsGoalStatusResult,
  currency = "CAD"
): string {
  const scope = result.scope ? `matching "${result.scope}"` : "for all active goals";
  if (result.rows.length === 0) {
    return `SAVINGS GOAL STATUS ${scope}: none found. Active savings goals: ${result.totalGoals}.`;
  }

  const lines = [
    `SAVINGS GOAL STATUS ${scope} - server-computed savings-goal progress from tracked destinations or manual goal amounts:`,
    `- As of ${result.asOf}; goals shown ${result.shownGoals} of ${result.totalGoals}; reached ${result.reachedCount}`,
    `- Totals shown: target ${money(result.totalTarget, currency)}; saved ${money(result.totalSaved, currency)}; remaining ${money(result.totalRemaining, currency)}`,
    "",
    "SAVINGS GOALS:",
  ];

  for (const row of result.rows) {
    lines.push(
      `- ${row.name}: target ${money(row.target, currency)}; saved ${money(row.saved, currency)}; remaining ${money(row.remaining, currency)}; progress ${pct(row.pct)}; reached ${row.reached ? "yes" : "no"}; target date ${row.targetDate?.slice(0, 10) ?? "not set"}; days until target ${row.daysUntilTarget ?? "n/a"}; monthly pace needed ${row.paceNeededMonthly == null ? "n/a" : money(row.paceNeededMonthly, currency)}; tracking ${row.tracked ? "destination transactions" : "manual amount"}; destination ${row.destinationLabel ?? "not linked"}`
    );
  }

  return lines.join("\n");
}
