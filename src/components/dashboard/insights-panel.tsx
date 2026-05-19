import { formatMoney } from "@/lib/format";

import type { DashboardData } from "./types";

export function InsightsPanel({ data }: { data: DashboardData }) {
  const insights = data.insights;
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Insights · {data.currentMonthLabel}</div>
        <div className="panel-meta">AUTO</div>
      </div>
      <div className="panel-body">
        <div className="insights-list">
          <div className="row">
            <span>Avg daily spend</span>
            <span className="mono tabular">{formatMoney(insights.avgDailySpend)}</span>
          </div>
          <div className="row">
            <span>Largest expense</span>
            <span className="mono tabular">
              {insights.largestExpense ? formatMoney(insights.largestExpense.amount) : "—"}
            </span>
          </div>
          <div className="row">
            <span>Subscriptions</span>
            <span className="mono tabular">
              {insights.subscriptionsCount
                ? `${formatMoney(insights.subscriptionsTotal)} · ${insights.subscriptionsCount}`
                : "—"}
            </span>
          </div>
          <div className="row">
            <span>Savings rate</span>
            <span
              className="mono tabular"
              style={{
                color:
                  insights.savingsRate != null && insights.savingsRate > 0
                    ? "var(--pos)"
                    : insights.savingsRate != null && insights.savingsRate < 0
                      ? "var(--neg)"
                      : undefined,
              }}
            >
              {insights.savingsRate != null ? `${insights.savingsRate.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="row">
            <span>Days remaining</span>
            <span className="mono tabular">{insights.daysRemaining}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
