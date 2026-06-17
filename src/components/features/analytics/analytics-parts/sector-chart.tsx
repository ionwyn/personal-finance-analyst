"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type SectorChartPoint = {
  name: string;
  weightPct: number;
  mvCad: number;
  color: string;
};

const money0 = (v: number) =>
  "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

function SectorTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: { mvCad: number; color: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="tt">
      <div className="tt-label">{p.name}</div>
      <div className="tt-row">
        <span className="k">Weight</span>
        <span className="v">{p.value?.toFixed(1)}%</span>
      </div>
      <div className="tt-row">
        <span className="k">MV</span>
        <span className="v">{p.payload?.mvCad != null ? money0(p.payload.mvCad) : "—"}</span>
      </div>
    </div>
  );
}

export function SectorChart({ data }: { data: SectorChartPoint[] }) {
  return (
    <div style={{ width: 160, height: 160, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
        <PieChart>
          <Pie
            data={data}
            dataKey="weightPct"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            strokeWidth={0}
          >
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip content={<SectorTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
