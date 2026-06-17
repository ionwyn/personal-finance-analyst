"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CurveChartPoint = {
  tenor: string;
  Today: number | null;
  "1M ago": number | null;
  "1Y ago": number | null;
};

type CurveTipPayload = { name?: string; value?: number; stroke?: string };

function CurveTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: CurveTipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="tt-label">{label} tenor</div>
      {payload.map((p) => (
        <div key={p.name} className="tt-row">
          <span className="k">
            <i className="tt-sw" style={{ background: p.stroke }} />
            {p.name}
          </span>
          <span className="v">{p.value?.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

export function CurveChart({
  data,
  domain,
}: {
  data: CurveChartPoint[];
  domain: [number, number];
}) {
  return (
    <div style={{ width: "100%", height: 216 }}>
      <ResponsiveContainer initialDimension={{ width: 1, height: 1 }}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -2 }}>
          <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="tenor"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
          />
          <YAxis
            domain={domain}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickFormatter={(v: number) => v.toFixed(1) + "%"}
          />
          <Tooltip content={<CurveTooltip />} />
          <Line
            type="monotone"
            dataKey="1Y ago"
            stroke="var(--text-4)"
            strokeWidth={1.2}
            strokeDasharray="2 3"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="1M ago"
            stroke="var(--info)"
            strokeWidth={1.2}
            strokeDasharray="4 3"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Today"
            stroke="var(--accent)"
            strokeWidth={1.8}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
