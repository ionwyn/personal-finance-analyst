import { format } from "date-fns";

import { fetchBudgetStatus, serializeBudgetStatus, type BudgetStatusResult } from "@/lib/assistant/budget";
import { fetchCycleStatus, serializeCycleStatus, type CycleStatusResult } from "@/lib/assistant/cycle";
import {
  fetchPeriodComparison,
  fetchTopAggregates,
  serializeAggregateRows,
  serializePeriodComparison,
  type AggregateResult,
  type PeriodComparisonResult,
  type Period,
  type ScopedFilters,
} from "@/lib/assistant/query";
import {
  fetchRecurringSpendStatus,
  serializeRecurringSpendStatus,
  type RecurringSpendStatusResult,
} from "@/lib/assistant/recurring";
import {
  fetchSavingsGoalStatus,
  serializeSavingsGoalStatus,
  type SavingsGoalStatusResult,
} from "@/lib/assistant/savings";

// ─── Savings-advice synthesis ──────────────────────────────────────────────
// This intent gives coaching-style advice ("cut back on X", "you're on
// track"), which is a deliberate, scoped exception to the assistant's usual
// neutral tone (see adviceNarrationAddendum in assistant-config.json). It does
// NOT fetch any new data — it composes the same fetchers other intents already
// use, so any directive the model gives is still anchored to real,
// server-computed evidence rather than the model's own judgment about what
// "unnecessary" spending looks like.

export type SavingsAdviceFeasibility =
  | {
      targetAmount: number;
      cycleEndDate: string;
      daysRemaining: number;
      projectedAvailable: number;
      gap: number;
      feasible: boolean;
      requiredDailyCut: number | null;
      dailyDiscretionaryRoom: number;
    }
  | {
      targetAmount: number;
      unavailable: true;
      reason: string;
    };

export type SavingsAdviceResult = {
  asOf: string;
  feasibility: SavingsAdviceFeasibility | null;
  cycle: CycleStatusResult;
  budget: BudgetStatusResult;
  recurring: RecurringSpendStatusResult;
  periodComparison: PeriodComparisonResult;
  topCategories: AggregateResult;
  topMerchants: AggregateResult;
  goal: SavingsGoalStatusResult | null;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-CA")}`;
}

/**
 * Feasibility is always assessed against the current pay cycle's end date —
 * never an arbitrary user-stated deadline — since cycle.ts is the only place
 * with robust date arithmetic already built. `projectedAvailable` combines
 * what's already safely sweepable today with the discretionary room not yet
 * spent-or-saved this cycle, so an ask early in the cycle isn't understated.
 */
function computeFeasibility(targetAmount: number, cycle: CycleStatusResult): SavingsAdviceFeasibility {
  if (!cycle) {
    return { targetAmount, unavailable: true, reason: "no pay cycle is configured" };
  }

  const projectedAvailable = round(cycle.safeToSweep.amount + cycle.discretionary.remaining);
  const gap = round(targetAmount - projectedAvailable);
  const feasible = gap <= 0;
  const daysRemaining = cycle.cycle.daysRemaining;

  return {
    targetAmount,
    cycleEndDate: cycle.cycle.endDate,
    daysRemaining,
    projectedAvailable,
    gap,
    feasible,
    requiredDailyCut: !feasible && daysRemaining > 0 ? round(gap / daysRemaining) : null,
    dailyDiscretionaryRoom: cycle.discretionary.dailyRoom,
  };
}

export async function fetchSavingsAdvice(
  tenantId: string,
  tenantSlug: string,
  filters: ScopedFilters = {},
  now: Date = new Date()
): Promise<SavingsAdviceResult> {
  const period: Period = filters.period ?? "last_30_days";
  const aggregateFilters: ScopedFilters = { ...filters, bucket: "spending", period };
  const hasGoalScope = Boolean(filters.q || filters.category);

  const [cycle, budget, recurring, periodComparison, topCategories, topMerchants, goal] =
    await Promise.all([
      fetchCycleStatus(tenantId, now),
      fetchBudgetStatus(tenantId, filters, now),
      fetchRecurringSpendStatus(tenantId, filters),
      fetchPeriodComparison(tenantSlug, aggregateFilters, now),
      fetchTopAggregates(tenantSlug, aggregateFilters, "category", 6, now),
      fetchTopAggregates(tenantSlug, aggregateFilters, "merchant", 6, now),
      hasGoalScope ? fetchSavingsGoalStatus(tenantId, filters, now) : Promise.resolve(null),
    ]);

  const feasibility =
    filters.targetAmount == null ? null : computeFeasibility(filters.targetAmount, cycle);

  return {
    asOf: format(now, "yyyy-MM-dd"),
    feasibility,
    cycle,
    budget,
    recurring,
    periodComparison,
    topCategories,
    topMerchants,
    goal,
  };
}

function serializeFeasibility(feasibility: SavingsAdviceFeasibility, currency: string): string {
  if ("unavailable" in feasibility) {
    return `FEASIBILITY: cannot be assessed for a target of ${money(feasibility.targetAmount, currency)} — ${feasibility.reason}.`;
  }

  const verdict = feasibility.feasible
    ? `feasible — projected available (${money(feasibility.projectedAvailable, currency)}) already covers the target`
    : `not feasible at the current pace — projected available is ${money(feasibility.projectedAvailable, currency)}, a gap of ${money(feasibility.gap, currency)}`;

  const cutLine =
    feasibility.requiredDailyCut == null
      ? ""
      : ` Closing that gap needs about ${money(feasibility.requiredDailyCut, currency)}/day in cuts, against ${money(feasibility.dailyDiscretionaryRoom, currency)}/day of current discretionary room.`;

  return (
    `FEASIBILITY: target ${money(feasibility.targetAmount, currency)} by cycle end ` +
    `(${feasibility.cycleEndDate}, ${feasibility.daysRemaining} day${feasibility.daysRemaining === 1 ? "" : "s"} remaining) — ${verdict}.${cutLine}`
  );
}

/**
 * Reuses each sub-domain's own serializer rather than re-flattening every
 * field by hand, so this stays the single place that assembles "advice
 * context" without becoming a second source of truth for how e.g. budget pace
 * or recurring spend is phrased elsewhere in the assistant.
 */
export function serializeSavingsAdvice(result: SavingsAdviceResult, currency = "CAD"): string {
  const lines = [
    "SAVINGS ADVICE CONTEXT - server-computed signals for coaching-style savings advice:",
  ];

  if (result.feasibility) {
    lines.push(serializeFeasibility(result.feasibility, currency), "");
  }

  if (result.goal) {
    lines.push(serializeSavingsGoalStatus(result.goal, currency), "");
  }

  lines.push(
    serializeCycleStatus(result.cycle, currency),
    "",
    serializeBudgetStatus(result.budget, currency),
    "",
    serializeRecurringSpendStatus(result.recurring, currency),
    "",
    serializePeriodComparison(result.periodComparison, currency),
    "",
    serializeAggregateRows(result.topCategories, currency),
    "",
    serializeAggregateRows(result.topMerchants, currency)
  );

  return lines.join("\n");
}
