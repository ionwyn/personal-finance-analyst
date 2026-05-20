import { BalanceChart, CashflowChart } from "@/components/shared/charts";
import { EmptyPanelMessage } from "@/components/ui";
import { formatMoney, formatMonthDay } from "@/lib/format";

import chartStyles from "@/components/shared/charts.module.scss";
import type { DashboardData } from "./types";

export function CashflowPanel({ data }: { data: DashboardData }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="panel-title">Cashflow · 6M</div>
          <div className={chartStyles.chartLegend}>
            <span className={chartStyles.lgItem}>
              <i className={chartStyles.lgSw} style={{ background: "var(--pos)" }} />
              Income
            </span>
            <span className={chartStyles.lgItem}>
              <i className={chartStyles.lgSw} style={{ background: "var(--neg)" }} />
              Spending
            </span>
          </div>
        </div>
        <div className="panel-meta">{monthRangeLabel(data.monthlyCashflow)}</div>
      </div>
      <div className="panel-body" style={{ height: 240 }}>
        <CashflowChart data={data.monthlyCashflow} />
      </div>
    </div>
  );
}

export function NetWorthPanel({ data }: { data: DashboardData }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="panel-title">Net worth · 6M</div>
          {data.investments.summary.lastSync ? (
            <span className={chartStyles.chartAnno}>
              <i className={chartStyles.annoDot} />
              Investments added {formatMonthDay(data.investments.summary.lastSync)}
            </span>
          ) : null}
        </div>
        <div className="panel-meta">{netWorthChange(data.balanceHistory)}</div>
      </div>
      <div className="panel-body" style={{ height: 200 }}>
        {data.balanceHistory.length ? (
          <BalanceChart data={data.balanceHistory} />
        ) : (
          <EmptyPanelMessage text="No balance snapshots yet" />
        )}
      </div>
    </div>
  );
}

function monthRangeLabel(months: { month: string }[]) {
  if (!months.length) return "";
  return `${months[0].month.toUpperCase()} — ${months[months.length - 1].month.toUpperCase()}`;
}

function netWorthChange(balanceHistory: { balance: number }[]) {
  if (balanceHistory.length < 2) return "";
  const first = balanceHistory[0].balance;
  const last = balanceHistory[balanceHistory.length - 1].balance;
  const diff = last - first;
  const pct = first ? (diff / Math.abs(first)) * 100 : 0;
  const sign = diff >= 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(diff))} (${sign}${Math.abs(pct).toFixed(1)}%)`;
}
