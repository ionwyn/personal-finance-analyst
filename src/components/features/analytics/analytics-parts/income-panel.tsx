"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { IncomeStats } from "@/lib/investments/analytics-loader";

// ─── Investment income — received (synced) + forward estimate ──────────────

function IncomeTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      <div className="tt-row">
        <span className="k">
          <i className="tt-sw" style={{ background: "var(--accent)" }} />
          Income
        </span>
        <span className="v">${payload[0].value.toFixed(0)}</span>
      </div>
    </div>
  );
}

export function IncomePanel({ income }: { income: IncomeStats }) {
  const data = income.months.map((m) => ({
    label: new Date(m.month + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "short" }),
    amount: m.amountCad,
  }));

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Investment income</div>
        <div className="panel-meta">DIVIDENDS &amp; DISTRIBUTIONS · CAD-EQUIV</div>
      </div>
      <div className="panel-body">
        <div className="pos-divs-stats">
          <div>
            <span className="lbl">RECEIVED · TTM</span>
            <span className="val">${income.ttmReceivedCad.toFixed(0)}</span>
          </div>
          <div>
            <span className="lbl">PAYMENTS</span>
            <span className="val">{income.paymentCount}</span>
          </div>
          {income.forwardEstCad != null && (
            <div className="mine">
              <span className="lbl">FWD EST. / YR</span>
              <span className="val">
                ${income.forwardEstCad.toFixed(0)}{" "}
                <em>yields cover {income.forwardCoveragePct.toFixed(0)}% of MV</em>
              </span>
            </div>
          )}
        </div>
        <div style={{ width: "100%", height: 120 }}>
          <ResponsiveContainer initialDimension={{ width: 1, height: 1 }}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: "var(--text-4)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 9, fill: "var(--text-4)" }}
                tickFormatter={(v: number) => "$" + v.toFixed(0)}
              />
              <Tooltip content={<IncomeTip />} cursor={{ fill: "var(--hover)" }} />
              <Bar dataKey="amount" fill="var(--accent)" radius={[2, 2, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
