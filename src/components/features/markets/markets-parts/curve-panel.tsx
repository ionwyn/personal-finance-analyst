import type { YieldCurveData } from "@/lib/market-data";

import { CurveChartDynamic } from "./curve-panel-dynamic";

// ─── US Treasury yield curve — today vs 1M vs 1Y ago ───────────────────────

export function CurvePanel({ curve }: { curve: YieldCurveData }) {
  const data = curve.points.map((p) => ({
    tenor: p.tenor,
    Today: p.today,
    "1M ago": p.monthAgo,
    "1Y ago": p.yearAgo,
  }));

  const t2 = curve.points.find((p) => p.tenor === "2Y")?.today ?? null;
  const t10 = curve.points.find((p) => p.tenor === "10Y")?.today ?? null;
  const spread = t2 != null && t10 != null ? (t10 - t2) * 100 : null; // bps

  const all = curve.points.flatMap((p) =>
    [p.today, p.monthAgo, p.yearAgo].filter((v): v is number => v != null)
  );
  const lo = all.length ? Math.floor(Math.min(...all) * 4) / 4 : 0;
  const hi = all.length ? Math.ceil(Math.max(...all) * 4) / 4 : 6;

  return (
    <div className="panel mkt-curve">
      <div className="panel-head">
        <div className="panel-title">US Treasury curve</div>
        <div className="panel-meta">FRED · AS OF {curve.asOf ?? "—"}</div>
      </div>
      <div className="panel-body" style={{ paddingBottom: 6 }}>
        {data.length === 0 ? (
          <div className="mkt-empty">Yield curve unavailable.</div>
        ) : (
          <>
            <CurveChartDynamic data={data} domain={[lo, hi]} />
            <div className="mkt-curve-foot">
              <div className="mkt-curve-legend">
                <span>
                  <i style={{ background: "var(--accent)" }} /> Today
                </span>
                <span>
                  <i style={{ background: "var(--info)" }} /> 1M ago
                </span>
                <span>
                  <i style={{ background: "var(--text-4)" }} /> 1Y ago
                </span>
              </div>
              {spread != null && (
                <div className={"mkt-curve-spread " + (spread >= 0 ? "pos" : "neg")}>
                  2s10s {spread >= 0 ? "+" : "−"}
                  {Math.abs(spread).toFixed(0)} bps
                  <span className="st">{spread >= 0 ? "NORMAL" : "INVERTED"}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
