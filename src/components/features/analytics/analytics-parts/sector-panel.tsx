import type { SectorSlice } from "@/lib/investments/analytics-loader";

import { SectorChartDynamic } from "./sector-panel-dynamic";

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
          <SectorChartDynamic data={data} />
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
