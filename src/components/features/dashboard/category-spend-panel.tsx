"use client";

import { useState } from "react";

import { CategoryDonut } from "@/components/shared/charts";
import { formatMoney } from "@/lib/format";
import { SegmentedControl } from "@/components/ui";
import type { CategorySpend } from "@/lib/analytics";

import chartStyles from "@/components/shared/charts.module.scss";

type Period = "7d" | "30d" | "mtd";

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
          <SegmentedControl
            label="Spend period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "7d", label: "1W" },
              { value: "30d", label: "30D" },
              { value: "mtd", label: "MTD" },
            ]}
          />
          <div className="panel-meta">{formatMoney(total)}</div>
        </div>
      </div>
      {data.length ? (
        <>
          <div className={chartStyles.pieRow}>
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
          <div className={chartStyles.catList}>
            {data.map((c) => (
              <div className={chartStyles.catItem} key={c.category}>
                <i className={chartStyles.catSw} style={{ background: c.color }} />
                <span className={chartStyles.catName}>{c.category}</span>
                <span className={chartStyles.catPct}>{c.pct.toFixed(1)}%</span>
                <span className={chartStyles.catAmt}>{formatMoney(c.amount)}</span>
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
