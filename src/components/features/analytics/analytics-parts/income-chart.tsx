"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type IncomeChartPoint = {
  label: string;
  amount: number;
};

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

export function IncomeChart({ data }: { data: IncomeChartPoint[] }) {
  return (
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
  );
}
