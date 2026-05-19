"use client";

import { useState } from "react";

import { CategoryDonut } from "@/components/charts";
import { formatMoney } from "@/components/big-number";
import type { CategorySpend } from "@/lib/analytics";

type Period = "7d" | "30d" | "mtd";

const PERIODS: { label: string; key: Period }[] = [
  { label: "1W", key: "7d" },
  { label: "30D", key: "30d" },
  { label: "MTD", key: "mtd" },
];

export function CategorySpendPanel({
  spend7d,
  spend30d,
  spendMTD,
}: {
  spend7d: CategorySpend[];
  spend30d: CategorySpend[];
  spendMTD: CategorySpend[];
}) {
  const [period, setPeriod] = useState<Period>("30d");

  const data = period === "7d" ? spend7d : period === "mtd" ? spendMTD : spend30d;
  const total = data.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Spend by category</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: "2px 7px",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: period === p.key ? "var(--text)" : "transparent",
                  color: period === p.key ? "var(--bg)" : "var(--text-3)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="panel-meta">{formatMoney(total)}</div>
        </div>
      </div>
      {data.length ? (
        <>
          <div className="pie-row">
            <CategoryDonut data={data} total={total} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>
                Top category
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                {data[0].category}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-2)",
                  marginTop: 2,
                }}
              >
                {formatMoney(data[0].amount)} · {data[0].pct.toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="cat-list">
            {data.map((c) => (
              <div className="cat-item" key={c.category}>
                <i className="cat-sw" style={{ background: c.color }} />
                <span className="cat-name">{c.category}</span>
                <span className="cat-pct">{c.pct.toFixed(1)}%</span>
                <span className="cat-amt">{formatMoney(c.amount)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="panel-body">
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>No expense transactions yet.</p>
        </div>
      )}
    </div>
  );
}
