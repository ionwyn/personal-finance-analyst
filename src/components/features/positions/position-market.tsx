"use client";

import { useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ReturnPeriod } from "@/lib/market-data";
import type { PositionDetail } from "@/lib/investments/types";

import {
  AiInsightsDeferred,
  DecisionDeferred,
  FundamentalsDeferred,
  NewsDeferred,
  PriceChartDeferred,
  ReturnPeriodsDeferred,
  TechnicalsDeferred,
} from "./position-deferred";

// Re-export AI/decision deferred so position-view only imports from here.
export { AiInsightsDeferred, DecisionDeferred };

// ─── Formatters ───────────────────────────────────────────────────────────
const money = (n: number, dp = 2) =>
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (n: number, dp = 2) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(dp) + "%";
const big = (n: number) =>
  n >= 1e12
    ? "$" + (n / 1e12).toFixed(2) + "T"
    : n >= 1e9
      ? "$" + (n / 1e9).toFixed(1) + "B"
      : n >= 1e6
        ? "$" + (n / 1e6).toFixed(0) + "M"
        : "$" + Math.round(n).toLocaleString();

// ─── Price chart ──────────────────────────────────────────────────────────

const RANGE_DAYS: Record<string, number> = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365, All: 9999 };

function ChartTooltip({
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
          <i className="tt-sw" style={{ background: "var(--invest)" }} />
          Close
        </span>
        <span className="v">${payload[0].value.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function PriceChart({ p }: { p: PositionDetail }) {
  const [range, setRange] = useState("6M");
  const [showCost, setShowCost] = useState(true);
  const [showSma, setShowSma] = useState(false);

  const md = p.marketData;
  if (!md || md.series.length === 0) return <PriceChartDeferred p={p} />;

  const ranges = ["1M", "3M", "6M", "1Y", "All"];
  const cutDays = RANGE_DAYS[range] ?? 182;
  // Use a fixed reference time so this is computed once per render cycle, not
  // as a side effect inside a map/filter that would trigger on every call.
  const nowMs = md.series.at(-1) ? new Date(md.series.at(-1)!.date + "T12:00:00Z").getTime() : 0;
  const cutDate = new Date(nowMs - cutDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = md.series.filter((s) => s.date >= cutDate);

  const prices = data.map((d) => d.close);
  const minPx = Math.min(...prices, p.avgNative ?? Infinity);
  const maxPx = Math.max(...prices, p.avgNative ?? -Infinity);
  const pad = (maxPx - minPx) * 0.08 || 1;

  const q = md.quote;
  const t = md.technicals;
  const high52w = q?.high52w;
  const low52w = q?.low52w;
  const fromHigh = high52w && q?.price ? ((q.price - high52w) / high52w) * 100 : null;
  const vsCost =
    p.avgNative != null && q?.price != null ? ((q.price - p.avgNative) / p.avgNative) * 100 : null;

  // Map trade activity to chart markers.
  const trades = p.activity
    .filter((a) => a.type === "BUY" || a.type === "SELL")
    .filter((a) => a.tradeDate != null && a.tradeDate.slice(0, 10) >= cutDate)
    .map((a) => {
      const date = a.tradeDate!.slice(0, 10);
      const pt = data.find((d) => d.date >= date);
      return pt ? { ...a, chartDate: pt.date, mPx: a.price ?? pt.close } : null;
    })
    .filter(Boolean) as { type: string; chartDate: string; mPx: number }[];

  return (
    <div className="pos-chart-wrap">
      <div className="pos-chart-toolbar">
        <div className="pos-tf">
          {ranges.map((r) => (
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
        <span style={{ flex: 1 }} />
        <div className="pos-overlays">
          {p.avgNative != null && (
            <button
              type="button"
              className={"pos-toggle " + (showCost ? "on" : "")}
              onClick={() => setShowCost((v) => !v)}
            >
              <i className="dot" style={{ background: "var(--accent)" }} />
              My avg cost
            </button>
          )}
          {t.sma50 != null && (
            <button
              type="button"
              className={"pos-toggle " + (showSma ? "on" : "")}
              onClick={() => setShowSma((v) => !v)}
            >
              <i className="dot" style={{ background: "var(--info)" }} />
              50D MA
            </button>
          )}
        </div>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="pxFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--invest)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--invest)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 6)}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickFormatter={(v: string) => {
                const d = new Date(v + "T12:00:00Z");
                return d.toLocaleString("en-US", { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              domain={[minPx - pad, maxPx + pad]}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickFormatter={(v: number) => "$" + v.toFixed(0)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="close" stroke="none" fill="url(#pxFill)" />
            <Line
              type="monotone"
              dataKey="close"
              stroke="var(--invest)"
              strokeWidth={1.6}
              dot={false}
            />
            {showCost && p.avgNative != null && (
              <ReferenceLine
                y={p.avgNative}
                stroke="var(--accent)"
                strokeDasharray="4 3"
                label={{
                  value: `MY COST $${p.avgNative.toFixed(2)}`,
                  position: "insideTopRight",
                  fill: "var(--accent)",
                  fontSize: 10,
                  offset: 8,
                }}
              />
            )}
            {showSma && t.sma50 != null && (
              <ReferenceLine
                y={t.sma50}
                stroke="var(--info)"
                strokeDasharray="2 2"
                label={{
                  value: `50D ${t.sma50.toFixed(0)}`,
                  position: "insideTopLeft",
                  fill: "var(--info)",
                  fontSize: 10,
                }}
              />
            )}
            {trades.map((m, i) => (
              <ReferenceDot
                key={i}
                x={m.chartDate}
                y={m.mPx}
                r={5}
                fill={m.type === "BUY" ? "var(--pos)" : "var(--neg)"}
                stroke="var(--bg)"
                strokeWidth={2}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="pos-chart-foot">
        <div className="pos-chart-stats">
          <span>
            <span className="lbl">52W RANGE</span>{" "}
            <span className="v">
              {low52w != null && high52w != null
                ? `$${low52w.toFixed(2)} – $${high52w.toFixed(2)}`
                : "—"}
            </span>
          </span>
          <span>
            <span className="lbl">FROM HIGH</span>{" "}
            <span className={"v " + (fromHigh != null && fromHigh < 0 ? "neg" : "")}>
              {fromHigh != null ? pct(fromHigh, 1) : "—"}
            </span>
          </span>
          <span>
            <span className="lbl">VS MY COST</span>{" "}
            <span className={"v " + (vsCost != null ? (vsCost >= 0 ? "pos" : "neg") : "")}>
              {vsCost != null ? pct(vsCost, 1) : "—"}
            </span>
          </span>
          {t.rsi14 != null && (
            <span>
              <span className="lbl">RSI(14)</span> <span className="v">{t.rsi14.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Return by period ─────────────────────────────────────────────────────

export function ReturnPeriods({
  p,
  periods,
}: {
  p: PositionDetail;
  periods: ReturnPeriod[] | null;
}) {
  if (!periods || periods.every((pd) => pd.returnPct == null)) return <ReturnPeriodsDeferred />;

  return (
    <div className="pos-perf-periods">
      <div className="pos-perf-periods-head">
        <span>Return by period</span>
        <span className="pos-eyebrow">% return · on current market value · CAD-equiv</span>
      </div>
      <div className="pos-perf-periods-row">
        {periods.map((pd) => {
          const pos = (pd.returnPct ?? 0) >= 0;
          const nominalCad =
            pd.returnPct != null ? p.mvCad - p.mvCad / (1 + pd.returnPct / 100) : null;
          return (
            <div key={pd.label} className="pos-perf-pd">
              <div className="pd-lbl">{pd.label}</div>
              <div className={"pd-val " + (pos ? "pos" : "neg")}>
                {pd.returnPct == null
                  ? "—"
                  : (pos ? "+" : "−") + Math.abs(pd.returnPct).toFixed(1) + "%"}
              </div>
              <div className={"pd-bar " + (pos ? "pos" : "neg")}>
                <i style={{ width: Math.min(Math.abs(pd.returnPct ?? 0) * 1.6, 100) + "%" }} />
              </div>
              <div className={"pd-nom " + (pos ? "pos" : "neg")}>
                {nominalCad == null
                  ? "—"
                  : (nominalCad >= 0 ? "+" : "−") + "$" + Math.abs(nominalCad).toFixed(0)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fundamentals ─────────────────────────────────────────────────────────

export function FundamentalsLive({ p }: { p: PositionDetail }) {
  const md = p.marketData;
  if (!md?.fundamentals) return <FundamentalsDeferred p={p} />;
  const f = md.fundamentals;
  const q = md.quote;

  const fmtPct = (v: number | null) => (v == null ? "—" : pct(v, 1));
  const fmtX = (v: number | null, dp = 1) => (v == null ? "—" : v.toFixed(dp) + "×");

  const cells: [string, string, string][] = p.isFund
    ? [
        ["Net assets", f.aum != null ? big(f.aum) : "—", "AUM"],
        [
          "Expense ratio",
          f.expenseRatioPct != null ? f.expenseRatioPct.toFixed(2) + "%" : "—",
          "MER",
        ],
        [
          "Dividend yield",
          f.dividendYieldPct != null ? f.dividendYieldPct.toFixed(2) + "%" : "—",
          "trailing",
        ],
        ["Market cap", q?.marketCap != null ? big(q.marketCap) : "—", "issuer"],
      ]
    : [
        ["Market cap", q?.marketCap != null ? big(q.marketCap) : "—", "current"],
        ["P/E (TTM)", fmtX(f.peRatio), "trailing"],
        ["P/E (Fwd)", fmtX(f.forwardPe), "consensus"],
        ["EV/EBITDA", fmtX(f.evEbitda), "trailing"],
        ["Revenue growth", fmtPct(f.revenueGrowthPct), "TTM YoY"],
        ["EPS growth", fmtPct(f.epsGrowthPct), "TTM YoY"],
        ["Gross margin", f.grossMarginPct != null ? f.grossMarginPct.toFixed(1) + "%" : "—", "TTM"],
        [
          "Operating margin",
          f.operatingMarginPct != null ? f.operatingMarginPct.toFixed(1) + "%" : "—",
          "TTM",
        ],
        ["Free cash flow", f.freeCashFlow != null ? big(Math.abs(f.freeCashFlow)) : "—", "TTM"],
        [
          "Dividend yield",
          f.dividendYieldPct != null ? f.dividendYieldPct.toFixed(2) + "%" : "—",
          "trailing",
        ],
      ];

  const metaLabel = p.isFund ? "FUND DATA" : "VIA YAHOO FINANCE";

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{p.isFund ? "Fund profile" : "Fundamentals"}</div>
        <div className="panel-meta">{metaLabel}</div>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        <div className="pos-fund-grid">
          {cells.map(([l, v, sub]) => (
            <div key={l} className="pos-fund-cell">
              <div className="lbl">{l}</div>
              <div className="val">{v}</div>
              <div className="sub">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Technicals ───────────────────────────────────────────────────────────

export function TechnicalsPanel({ p }: { p: PositionDetail }) {
  const [open, setOpen] = useState(false);
  const md = p.marketData;
  const t = md?.technicals;
  const q = md?.quote;

  if (!t || (t.sma50 == null && t.sma200 == null && t.rsi14 == null)) {
    return <TechnicalsDeferred />;
  }

  const rangePos =
    q?.high52w != null && q?.low52w != null && q?.price != null
      ? ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100
      : null;

  return (
    <div className="panel">
      <div className="panel-head" onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer" }}>
        <div className="panel-title">Technicals</div>
        <div className="panel-meta">
          {open ? "HIDE" : "SHOW"} · SECONDARY FOR LONG-HOLD INVESTORS
        </div>
      </div>
      {open && (
        <div className="panel-body">
          <div className="pos-tech-grid">
            {t.sma50 != null && (
              <div className="pos-tech-cell">
                <div className="lbl">50-day MA</div>
                <div className="val">{money(t.sma50)}</div>
                <div className={"sub " + (q?.price != null && q.price >= t.sma50 ? "pos" : "")}>
                  {q?.price != null
                    ? pct(((q.price - t.sma50) / t.sma50) * 100, 1) + " vs price"
                    : "—"}
                </div>
              </div>
            )}
            {t.sma200 != null && (
              <div className="pos-tech-cell">
                <div className="lbl">200-day MA</div>
                <div className="val">{money(t.sma200)}</div>
                <div className={"sub " + (q?.price != null && q.price >= t.sma200 ? "pos" : "")}>
                  {q?.price != null
                    ? pct(((q.price - t.sma200) / t.sma200) * 100, 1) + " vs price"
                    : "—"}
                </div>
              </div>
            )}
            {t.rsi14 != null && (
              <div className="pos-tech-cell rsi-cell">
                <div className="lbl">RSI(14)</div>
                <div className="val">{t.rsi14.toFixed(1)}</div>
                <div className="rsi-bar">
                  <span className="zone under" />
                  <span className="zone neutral" />
                  <span className="zone over" />
                  <i className="pin" style={{ left: t.rsi14 + "%" }} />
                </div>
                <div className="sub">
                  {t.rsi14 > 70 ? "overbought" : t.rsi14 < 30 ? "oversold" : "neutral"} · 30/70
                  bands
                </div>
              </div>
            )}
            {rangePos != null && q?.high52w != null && q?.low52w != null && (
              <div className="pos-tech-cell">
                <div className="lbl">52-week range</div>
                <div className="val">
                  ${q.low52w.toFixed(0)} – ${q.high52w.toFixed(0)}
                </div>
                <div className="range-bar">
                  <i className="pin" style={{ left: Math.max(0, Math.min(100, rangePos)) + "%" }} />
                </div>
                <div className="sub">at {rangePos.toFixed(0)}% of range</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── News ─────────────────────────────────────────────────────────────────

const TAG_COLOR: Record<string, string> = {
  SUPPLY: "var(--info)",
  REGULATORY: "var(--neg)",
  DIVIDEND: "var(--accent)",
  ANALYST: "var(--cat-4)",
  FUNDAMENTALS: "var(--invest)",
  EARNINGS: "var(--invest)",
  SECTOR: "var(--cat-2)",
  OPINION: "var(--text-3)",
};

export function NewsList({ p }: { p: PositionDetail }) {
  const news = p.marketData?.news ?? [];
  if (news.length === 0) return <NewsDeferred p={p} />;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">News &amp; events</div>
        <div className="panel-meta">VIA YAHOO FINANCE · {news.length} ITEMS</div>
      </div>
      <div className="panel-body flush">
        <div className="pos-news-list">
          {news.map((n, i) => {
            const dateStr = n.publishedAt
              ? new Date(n.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                })
              : "—";
            return (
              <a
                key={i}
                className="pos-news-row"
                href={n.url ?? "#"}
                target={n.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={n.url ? undefined : (e) => e.preventDefault()}
              >
                <div className="pos-news-date">
                  <span className="d">{dateStr}</span>
                  <span className="s">{n.source ?? "NEWS"}</span>
                </div>
                <div className="pos-news-body">
                  <div className="pos-news-title">{n.title}</div>
                  <div className="pos-news-meta">
                    <span className="pos-news-tag" style={{ color: TAG_COLOR["FUNDAMENTALS"] }}>
                      NEWS
                    </span>
                  </div>
                </div>
                <span style={{ width: 12, height: 12, color: "var(--text-4)" }}>›</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
