"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { BigNumber, formatMoney } from "@/components/big-number";
import { SegmentedControl, Switch } from "@/components/ui";
import type {
  CategoryRow,
  DetailedRow,
  Period,
  SpendingInsightData,
} from "@/lib/spending/getSpendingInsight";

type SortKey = "amount" | "pct" | "delta";

type DeltaCell = { cls: "pos" | "neg" | "flat"; text: string };

function deltaCell(cur: number, prev: number): DeltaCell {
  if (prev === 0 && cur === 0) return { cls: "flat", text: "—" };
  const diff = cur - prev;
  if (Math.abs(diff) < 0.01) return { cls: "flat", text: "—" };
  if (diff > 0) return { cls: "neg", text: `+$${diff.toFixed(2)}` };
  return { cls: "pos", text: `−$${Math.abs(diff).toFixed(2)}` };
}

function cleanSubName(parent: string, sub: string): string {
  const ps = parent.replace(/[&,]/g, "").trim();
  if (sub.toLowerCase().startsWith(ps.toLowerCase())) {
    return sub.slice(ps.length).trim() || sub;
  }
  return sub;
}

function BarStack({
  cur,
  prev,
  scale,
  color,
  showShadow,
  small,
}: {
  cur: number;
  prev: number;
  scale: number;
  color: string;
  showShadow: boolean;
  small?: boolean;
}) {
  const wrapClass = small ? "sub-bar-wrap" : "bar-wrap";
  const trackClass = small ? "sub-bar-track" : "bar-track";
  const curPct = scale > 0 ? Math.min(100, (cur / scale) * 100) : 0;
  const prevPct = scale > 0 ? Math.min(100, (prev / scale) * 100) : 0;
  const hasShadow = showShadow && prev > 0;

  return (
    <div className={wrapClass}>
      <div className={trackClass}>
        <div className="fill" style={{ width: `${curPct}%`, background: color }} />
      </div>
      {hasShadow ? (
        <div className={`${trackClass} shadow`}>
          <div className="fill" style={{ width: `${prevPct}%`, background: color }} />
        </div>
      ) : null}
    </div>
  );
}

export function SpendingInsightView({
  mtd,
  ytd,
}: {
  mtd: SpendingInsightData;
  ytd: SpendingInsightData;
}) {
  const [period, setPeriod] = useState<Period>("MTD");
  const [showShadow, setShowShadow] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const data = period === "MTD" ? mtd : ytd;

  const sortedCategories = useMemo(() => {
    const arr = [...data.categories];
    if (sortKey === "amount") arr.sort((a, b) => b.amount - a.amount);
    else if (sortKey === "pct") arr.sort((a, b) => b.pctOfIncome - a.pctOfIncome);
    else arr.sort((a, b) => Math.abs(b.amount - b.prevAmount) - Math.abs(a.amount - a.prevAmount));
    return arr;
  }, [data.categories, sortKey]);

  const barScale = useMemo(() => {
    let max = 0;
    for (const c of sortedCategories) {
      if (c.amount > max) max = c.amount;
      if (c.prevAmount > max) max = c.prevAmount;
    }
    return max;
  }, [sortedCategories]);

  const visibleSegs = useMemo(
    () => sortedCategories.filter((c) => c.amount > 0),
    [sortedCategories]
  );
  const topThree = useMemo(
    () => [...visibleSegs].sort((a, b) => b.amount - a.amount).slice(0, 3),
    [visibleSegs]
  );
  const largest = topThree[0];

  const totalDelta = data.totalSpending - data.prevTotalSpending;
  const pctOfIncome = data.totalIncome > 0 ? (data.totalSpending / data.totalIncome) * 100 : 0;

  const subtitle = period === "MTD" ? buildMtdSubtitle(data) : buildYtdSubtitle(data);

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
          <div className="si-sub">
            {subtitle.main}
            <span className="vs">VS {data.prevPeriodLabel.toUpperCase()}</span>
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
          <BigNumber value={Math.abs(totalDelta)} />
          <div className="kpi-meta">
            <span>prev {formatMoney(data.prevTotalSpending)}</span>
            <span style={{ color: "var(--text-4)" }}>·</span>
            <span style={{ color: totalDelta > 0 ? "var(--neg)" : "var(--pos)" }}>
              {totalDelta > 0 ? "+" : totalDelta < 0 ? "−" : ""}
              {formatMoney(Math.abs(totalDelta))}
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--accent)" }} />% of income
          </div>
          <span className="kpi-value">
            {pctOfIncome.toFixed(1)}
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

      <div className="spend-summary-strip">
        <div className="spend-summary-head">
          <div>
            <div className="spend-summary-eyebrow">Spent this period</div>
            <div className="spend-summary-total">{formatMoney(data.totalSpending)}</div>
            <div className="spend-summary-sub">
              Across <span className="v">{visibleSegs.length}</span>{" "}
              {visibleSegs.length === 1 ? "category" : "categories"}
              {largest ? (
                <>
                  {" · "}
                  Largest <span className="v">{largest.primary}</span> at{" "}
                  <span className="v">
                    {data.totalSpending > 0
                      ? ((largest.amount / data.totalSpending) * 100).toFixed(0)
                      : "0"}
                    %
                  </span>
                </>
              ) : null}
            </div>
          </div>
          {topThree.length > 0 ? (
            <div className="spend-summary-stat-row">
              {topThree.map((c) => {
                const pct = data.totalSpending > 0 ? (c.amount / data.totalSpending) * 100 : 0;
                return (
                  <div className="spend-summary-stat" key={c.primaryRaw || c.primary}>
                    <div className="spend-summary-stat-pct">
                      <span className="dot" style={{ background: c.color }} />
                      {pct.toFixed(0)}
                      <span className="unit">%</span>
                    </div>
                    <div className="spend-summary-stat-lbl">{c.primary}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {data.totalSpending > 0 ? (
          <div className="spend-summary-bar">
            {visibleSegs.map((c) => {
              const pct = (c.amount / data.totalSpending) * 100;
              return (
                <div
                  key={c.primaryRaw || c.primary}
                  className="spend-summary-seg"
                  style={{ width: `${pct}%`, background: c.color }}
                  title={`${c.primary} · ${pct.toFixed(1)}% · ${formatMoney(c.amount)}`}
                />
              );
            })}
          </div>
        ) : null}

        {visibleSegs.length > 0 ? (
          <div className="spend-summary-legend">
            {visibleSegs.map((c) => {
              const pct = data.totalSpending > 0 ? (c.amount / data.totalSpending) * 100 : 0;
              return (
                <div className="spend-summary-leg" key={c.primaryRaw || c.primary}>
                  <span className="dot" style={{ background: c.color }} />
                  <span className="nm">{c.primary}</span>
                  <span className="amt">{formatMoney(c.amount)}</span>
                  <span className="pct">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="cat-toolbar">
          <span className="meta">Categories · {data.categories.length}</span>
          <span className="spacer" />
          <Switch isSelected={showShadow} onChange={setShowShadow}>
            Shadow bar
          </Switch>
          <SegmentedControl
            label="Sort categories"
            value={sortKey}
            onChange={setSortKey}
            options={[
              { value: "amount", label: "$", ariaLabel: "Sort by amount" },
              { value: "pct", label: "%", ariaLabel: "Sort by percent of income" },
              { value: "delta", label: "Δ", ariaLabel: "Sort by delta" },
            ]}
          />
        </div>

        {sortedCategories.length === 0 ? (
          <div style={{ padding: 18, color: "var(--text-3)", fontSize: 12 }}>
            No spending recorded yet for this period.
          </div>
        ) : (
          sortedCategories.map((cat) => {
            const key = cat.primaryRaw || cat.primary;
            return (
              <CategoryRowItem
                key={key}
                cat={cat}
                income={data.totalIncome}
                scale={barScale}
                showShadow={showShadow}
                expanded={expanded.has(key)}
                onToggle={() => toggle(key)}
              />
            );
          })
        )}
      </div>

      <div className="si-caveat">
        Internal transfers, credit-card payments, and savings/investment moves are excluded from
        spending totals.
      </div>
    </>
  );
}

function CategoryRowItem({
  cat,
  income,
  scale,
  showShadow,
  expanded,
  onToggle,
}: {
  cat: CategoryRow;
  income: number;
  scale: number;
  showShadow: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pctIncome = income > 0 ? (cat.amount / income) * 100 : 0;
  const delta = deltaCell(cat.amount, cat.prevAmount);
  const hasSubs = cat.detailed.length > 0;

  const subScale = useMemo(() => {
    let max = 0;
    for (const d of cat.detailed) {
      if (d.amount > max) max = d.amount;
      if (d.prevAmount > max) max = d.prevAmount;
    }
    return max;
  }, [cat.detailed]);

  return (
    <>
      <div
        className={`cat-row ${expanded ? "expanded " : ""}${hasSubs ? "" : "no-sub"}`}
        onClick={() => {
          if (hasSubs) onToggle();
        }}
        role={hasSubs ? "button" : undefined}
        tabIndex={hasSubs ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasSubs && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="chev">
          <ChevronRight size={11} />
        </span>
        <i className="dot" style={{ background: cat.color }} />
        <span className="nm">{cat.primary}</span>
        <span className="pct">{pctIncome.toFixed(1)}% of income</span>
        <span className="amt">{formatMoney(cat.amount)}</span>
        <span className={`delta ${delta.cls}`}>{delta.text}</span>
        <BarStack
          cur={cat.amount}
          prev={cat.prevAmount}
          scale={scale}
          color={cat.color}
          showShadow={showShadow}
        />
      </div>
      {expanded && hasSubs ? (
        <div className="subcat-list">
          {cat.detailed.map((d) => (
            <SubcatRow
              key={d.detailedRaw || d.name}
              parent={cat.primary}
              color={cat.color}
              detail={d}
              income={income}
              scale={subScale}
              showShadow={showShadow}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function SubcatRow({
  parent,
  color,
  detail,
  income,
  scale,
  showShadow,
}: {
  parent: string;
  color: string;
  detail: DetailedRow;
  income: number;
  scale: number;
  showShadow: boolean;
}) {
  const subDelta = deltaCell(detail.amount, detail.prevAmount);
  const subPct = income > 0 ? (detail.amount / income) * 100 : 0;
  return (
    <div className="subcat-row no-txs">
      <span className="stub-chev" />
      <i className="dot" style={{ background: color }} />
      <span className="nm">{cleanSubName(parent, detail.name)}</span>
      <span className="pct">{subPct.toFixed(1)}%</span>
      <span className="amt">{formatMoney(detail.amount)}</span>
      <span className={`delta ${subDelta.cls}`}>{subDelta.text}</span>
      <BarStack
        cur={detail.amount}
        prev={detail.prevAmount}
        scale={scale}
        color={color}
        showShadow={showShadow}
        small
      />
    </div>
  );
}

function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <SegmentedControl
      label="Period"
      variant="accent"
      size="md"
      value={period}
      onChange={onChange}
      options={[
        { value: "MTD", label: "MTD" },
        { value: "YTD", label: "YTD" },
      ]}
    />
  );
}

function buildMtdSubtitle(data: SpendingInsightData): { main: string } {
  const end = toDate(data.rangeEnd);
  const day = end.getDate();
  const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  return {
    main: `${data.periodLabel.toUpperCase()} · MTD · DAY ${day} OF ${daysInMonth} · `,
  };
}

function buildYtdSubtitle(data: SpendingInsightData): { main: string } {
  return { main: `${data.periodLabel.toUpperCase()} · ` };
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}
