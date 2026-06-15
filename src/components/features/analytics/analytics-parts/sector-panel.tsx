"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { SectorSlice } from "@/lib/investments/analytics-loader";

// ─── Sector exposure — holdings MV weighted, donut chart ──────────────────

const SECTOR_COLORS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)",
];

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

export function SectorPanel({ sectors }: { sectors: SectorSlice[] }) {
  if (sectors.length === 0) return null;

  const data = sectors.slice(0, 8).map((s, i) => ({
    ...s,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }));

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Sector exposure</div>
        <div className="panel-meta">DIRECT HOLDINGS · FUND LOOK-THROUGH NOT APPLIED</div>
      </div>
      <div className="panel-body">
        <div className="sector-donut-layout">
          <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
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
                  {data.map((s, i) => (
                    <Cell key={s.name} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<SectorTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="sector-legend">
            {data.map((s) => (
              <div key={s.name} className="sector-legend-row">
                <i className="sw" style={{ background: s.color }} />
                <span className="nm">{s.name}</span>
                <span className="pct">{s.weightPct.toFixed(1)}%</span>
                <span className="mv">{money0(s.mvCad)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
