"use client";

import type { SectorSlice } from "@/lib/investments/analytics-loader";

// ─── Sector exposure — holdings MV weighted, funds bucketed ────────────────

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
  const max = sectors[0].weightPct || 1;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Sector exposure</div>
        <div className="panel-meta">DIRECT HOLDINGS · FUND LOOK-THROUGH NOT APPLIED</div>
      </div>
      <div className="panel-body">
        <div className="ana-sector-list">
          {sectors.slice(0, 8).map((s, i) => (
            <div key={s.name} className="ana-sector-row">
              <span className="nm">{s.name}</span>
              <div className="bar">
                <i
                  style={{
                    width: Math.max(2, (s.weightPct / max) * 100) + "%",
                    background: SECTOR_COLORS[i % SECTOR_COLORS.length],
                  }}
                />
              </div>
              <span className="pct">{s.weightPct.toFixed(1)}%</span>
              <span className="mv">{money0(s.mvCad)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
