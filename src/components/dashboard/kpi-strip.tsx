import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

import { BigNumber } from "@/components/big-number";
import { Sparkline } from "@/components/sparkline";
import { formatCompactMoney } from "@/lib/format";

import type { DashboardData } from "./types";

export function DashboardKpiStrip({ data }: { data: DashboardData }) {
  const totals = data.totals;
  return (
    <div className="kpi-grid">
      <KpiCell
        label="Net worth"
        dot="var(--accent)"
        value={<BigNumber value={totals.currentBalance} />}
        delta={data.deltas.balance}
        versus={data.previousMonthLabel}
        spark={data.sparks.balance}
        sparkColor="var(--accent)"
        subline={`cash ${formatCompactMoney(totals.cashBalance)} · inv ${formatCompactMoney(totals.investmentBalance)}`}
      />
      <KpiCell
        label={`Income · ${data.currentMonthLabel}`}
        dot="var(--pos)"
        value={<BigNumber value={totals.monthlyIncome} />}
        delta={data.deltas.income}
        versus={data.previousMonthLabel}
        spark={data.sparks.income}
        sparkColor="var(--pos)"
      />
      <KpiCell
        label={`Spend · ${data.currentMonthLabel}`}
        dot="var(--neg)"
        value={<BigNumber value={totals.monthlySpend} />}
        delta={data.deltas.spend}
        versus={data.previousMonthLabel}
        spark={data.sparks.spend}
        sparkColor="var(--neg)"
        deltaInvert
      />
      <KpiCell
        label="Net cashflow"
        dot="var(--info)"
        value={<BigNumber value={totals.netCashflow} signed />}
        delta={data.deltas.cashflow}
        versus={data.previousMonthLabel}
        spark={data.sparks.cashflow}
        sparkColor="var(--info)"
      />
    </div>
  );
}

function KpiCell({
  label,
  dot,
  value,
  delta,
  versus,
  spark,
  sparkColor,
  deltaInvert = false,
  subline,
}: {
  label: string;
  dot: string;
  value: ReactNode;
  delta: number | null;
  versus: string;
  spark: number[];
  sparkColor: string;
  deltaInvert?: boolean;
  subline?: string;
}) {
  const deltaIsPositive = delta == null ? null : delta >= 0;
  const isGood = deltaIsPositive == null ? null : deltaInvert ? !deltaIsPositive : deltaIsPositive;
  return (
    <div className="kpi">
      <div className="kpi-label">
        <i className="dot" style={{ background: dot }} />
        {label}
      </div>
      {value}
      <div className="kpi-meta">
        {delta != null ? (
          <span className={`delta ${isGood ? "pos" : "neg"}`}>
            {deltaIsPositive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : (
          <span className="delta" style={{ color: "var(--text-4)" }}>
            —
          </span>
        )}
        <span>{subline ?? `vs ${versus}`}</span>
      </div>
      {spark.length > 1 ? (
        <div className="kpi-spark">
          <Sparkline data={spark} color={sparkColor} fill />
        </div>
      ) : null}
    </div>
  );
}
