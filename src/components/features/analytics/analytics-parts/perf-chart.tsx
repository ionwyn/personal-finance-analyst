"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { SeriesPoint } from "@/lib/investments/analytics-loader";

// ─── Portfolio vs benchmarks — TWR index rebased to 100 at window start ─────

const WINDOWS = ["3M", "6M", "1Y", "ALL"] as const;
type Window = (typeof WINDOWS)[number];

function windowCutoff(endDate: string, window: Window): string | null {
  if (window === "ALL") return null;
  const d = new Date(endDate + "T00:00:00Z");
  if (window === "3M") d.setUTCMonth(d.getUTCMonth() - 3);
  else if (window === "6M") d.setUTCMonth(d.getUTCMonth() - 6);
  else d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

type Row = { date: string; Portfolio: number | null; "S&P 500": number | null; TSX: number | null };

function TipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; stroke?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="tt-row">
          <span className="k">
            <i className="tt-sw" style={{ background: p.stroke }} />
            {p.name}
          </span>
          <span className="v">{p.value != null ? p.value.toFixed(1) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function PerfChart({
  series,
  fxNote,
  mwrPct,
}: {
  series: SeriesPoint[];
  fxNote: string;
  mwrPct: number | null;
}) {
  const [range, setRange] = useState<Window>("1Y");

  if (series.length < 10) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">My holdings vs market</div>
          <div className="panel-meta">INSUFFICIENT PRICE HISTORY</div>
        </div>
        <div className="panel-body">
          <div className="mkt-empty">Price history is still warming up — check back shortly.</div>
        </div>
      </div>
    );
  }

  const endDate = series.at(-1)!.date;
  const cutoff = windowCutoff(endDate, range);
  const win = cutoff ? series.filter((p) => p.date >= cutoff) : series;
  const base = win[0]!;
  const norm = (v: number | null, b: number | null) =>
    v != null && b != null && b > 0 ? (v / b) * 100 : null;

  const data: Row[] = win.map((p) => ({
    date: p.date,
    Portfolio: norm(p.portfolio, base.portfolio),
    "S&P 500": norm(p.spx, base.spx),
    TSX: norm(p.tsx, base.tsx),
  }));

  const last = data.at(-1)!;
  const stat = (v: number | null) =>
    v == null ? "—" : (v >= 100 ? "+" : "−") + Math.abs(v - 100).toFixed(1) + "%";
  const tone = (v: number | null) => (v == null ? "" : v >= 100 ? "pos" : "neg");
  const mwrStat =
    mwrPct == null ? "—" : (mwrPct >= 0 ? "+" : "−") + Math.abs(mwrPct).toFixed(1) + "% p.a.";

  const all = data.flatMap((d) =>
    [d.Portfolio, d["S&P 500"], d.TSX].filter((v): v is number => v != null)
  );
  const lo = Math.floor(Math.min(...all) / 5) * 5;
  const hi = Math.ceil(Math.max(...all) / 5) * 5;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">My holdings vs market</div>
        <div className="panel-meta">TIME-WEIGHTED RETURN · {fxNote.toUpperCase()}</div>
      </div>
      <div className="panel-body" style={{ paddingBottom: 6 }}>
        <div className="ana-perf-toolbar">
          <div className="pos-tf">
            {WINDOWS.map((r) => (
              <button
                key={r}
                type="button"
                className={r === range ? "on" : ""}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="ana-perf-stats">
            <span>
              <i style={{ background: "var(--invest)" }} /> Portfolio{" "}
              <b className={tone(last.Portfolio)}>{stat(last.Portfolio)}</b>
            </span>
            <span>
              <i style={{ background: "var(--info)" }} /> S&amp;P 500{" "}
              <b className={tone(last["S&P 500"])}>{stat(last["S&P 500"])}</b>
            </span>
            <span>
              <i style={{ background: "var(--text-4)" }} /> TSX{" "}
              <b className={tone(last.TSX)}>{stat(last.TSX)}</b>
            </span>
            <span>
              Money-weighted return (XIRR){" "}
              <b className={mwrPct == null ? "" : mwrPct >= 0 ? "pos" : "neg"}>{mwrStat}</b>
            </span>
          </div>
        </div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer initialDimension={{ width: 1, height: 1 }}>
            <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -2 }}>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                interval={Math.floor(data.length / 6)}
                tick={{ fontSize: 10, fill: "var(--text-3)" }}
                tickFormatter={(v: string) =>
                  new Date(v + "T12:00:00Z").toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                domain={[lo, hi]}
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 10, fill: "var(--text-3)" }}
              />
              <Tooltip content={<TipContent />} />
              <Line
                type="monotone"
                dataKey="TSX"
                stroke="var(--text-4)"
                strokeWidth={1.1}
                strokeDasharray="2 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="S&P 500"
                stroke="var(--info)"
                strokeWidth={1.1}
                strokeDasharray="4 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Portfolio"
                stroke="var(--invest)"
                strokeWidth={1.8}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
