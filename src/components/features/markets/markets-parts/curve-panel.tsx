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

import type { YieldCurveData } from "@/lib/market-data";

// ─── US Treasury yield curve — today vs 1M vs 1Y ago ───────────────────────

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
            <div style={{ width: "100%", height: 216 }}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -2 }}>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="tenor"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--text-3)" }}
                  />
                  <YAxis
                    domain={[lo, hi]}
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
