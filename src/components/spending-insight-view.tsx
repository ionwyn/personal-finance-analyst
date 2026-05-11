"use client";

import { useMemo, useState } from "react";

import { BigNumber, formatMoney } from "@/components/big-number";
import { CategoryBar } from "@/components/category-bar";
import type {
  CategoryRow,
  Period,
  SpendingInsightData
} from "@/lib/spending/getSpendingInsight";

function pctOf(amount: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.max(0, Math.min(100, (amount / denom) * 100));
}

function deltaText(current: number, prev: number): string {
  const diff = current - prev;
  if (prev === 0) return current > 0 ? "+new" : "—";
  return formatMoney(diff, { sign: true });
}

export function SpendingInsightView({
  mtd,
  ytd
}: {
  mtd: SpendingInsightData;
  ytd: SpendingInsightData;
}) {
  const [period, setPeriod] = useState<Period>("MTD");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const data = period === "MTD" ? mtd : ytd;

  const topAmount = useMemo(() => {
    let max = 0;
    for (const c of data.categories) {
      if (c.amount > max) max = c.amount;
      if (c.prevAmount > max) max = c.prevAmount;
    }
    return max;
  }, [data]);

  const totalDelta = data.totalSpending - data.prevTotalSpending;
  const totalPctOfIncome = data.totalIncome > 0 ? (data.totalSpending / data.totalIncome) * 100 : 0;

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Spending Insight</div>
          <div className="page-sub">
            {data.periodLabel.toUpperCase()} · VS {data.prevPeriodLabel.toUpperCase()}
          </div>
        </div>
        <div className="page-actions">
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--neg)" }} />
            Total spent
          </div>
          <BigNumber value={data.totalSpending} />
          <div className="kpi-meta">
            <span>{data.periodLabel}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span
              className="dot"
              style={{ background: totalDelta > 0 ? "var(--neg)" : "var(--pos)" }}
            />
            vs {period === "MTD" ? "last month" : "last year"}
          </div>
          <BigNumber value={totalDelta} signed />
          <div className="kpi-meta">
            <span>
              prev {formatMoney(data.prevTotalSpending)} · {deltaText(data.totalSpending, data.prevTotalSpending)}
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--accent)" }} />
            % of income
          </div>
          <span className="kpi-value">
            {totalPctOfIncome.toFixed(1)}
            <span className="frac">%</span>
          </span>
          <div className="kpi-meta">
            <span>spent / income</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--pos)" }} />
            Income received
          </div>
          <BigNumber value={data.totalIncome} />
          <div className="kpi-meta">
            <span>prev {formatMoney(data.prevTotalIncome)}</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div className="panel-title">Categories</div>
          <div className="panel-meta">
            {data.categories.length} {data.categories.length === 1 ? "CATEGORY" : "CATEGORIES"}
            {" · "}
            SHADOW = {data.prevPeriodLabel.toUpperCase()}
          </div>
        </div>
        <div className="panel-body">
          {data.categories.length === 0 ? (
            <div style={{ color: "var(--text-3)", fontSize: 12 }}>
              No spending recorded yet for this period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.categories.map((c) => (
                <CategoryRowItem
                  key={c.primaryRaw || c.primary}
                  row={c}
                  topAmount={topAmount}
                  expanded={expanded.has(c.primaryRaw || c.primary)}
                  onToggle={() => toggle(c.primaryRaw || c.primary)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="foot-note">
        <span>
          Internal transfers (TRANSFER_OUT, credit card payments, savings/investment moves) are excluded
          from spending totals.
        </span>
        <span>⌘1 dashboard</span>
      </div>
    </>
  );
}

function CategoryRowItem({
  row,
  topAmount,
  expanded,
  onToggle
}: {
  row: CategoryRow;
  topAmount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const delta = row.prevAmount > 0 ? row.amount - row.prevAmount : null;
  const detailedTop = useMemo(() => {
    let max = 0;
    for (const d of row.detailed) {
      if (d.amount > max) max = d.amount;
      if (d.prevAmount > max) max = d.prevAmount;
    }
    return max;
  }, [row.detailed]);

  return (
    <div>
      <CategoryBar
        label={`${row.primary} · ${row.pctOfIncome.toFixed(1)}% of income`}
        color={row.color}
        amount={row.amount}
        pct={pctOf(row.amount, topAmount)}
        delta={delta}
        prevAmount={row.prevAmount}
        prevPct={pctOf(row.prevAmount, topAmount)}
        expandable={row.detailed.length > 0}
        expanded={expanded}
        onToggle={row.detailed.length > 0 ? onToggle : undefined}
      />
      {expanded && row.detailed.length > 0 ? (
        <div
          style={{
            marginTop: 8,
            marginLeft: 18,
            paddingLeft: 10,
            borderLeft: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          {row.detailed.map((d) => (
            <CategoryBar
              key={d.detailedRaw || d.name}
              label={d.name}
              color={row.color}
              amount={d.amount}
              pct={pctOf(d.amount, detailedTop)}
              delta={d.prevAmount > 0 ? d.amount - d.prevAmount : null}
              prevAmount={d.prevAmount}
              prevPct={pctOf(d.prevAmount, detailedTop)}
              size="sm"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PeriodToggle({
  period,
  onChange
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden"
      }}
    >
      {(["MTD", "YTD"] as Period[]).map((p) => {
        const active = p === period;
        return (
          <button
            key={p}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(p)}
            style={{
              all: "unset",
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.06em",
              background: active ? "var(--accent-dim)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-3)"
            }}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
