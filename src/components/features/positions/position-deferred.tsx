"use client";

import { useState } from "react";

import { DeferredOverlay } from "@/components/ui";
import type { PositionDetail } from "@/lib/investments/types";

// These sections render the real design at full fidelity but their data sources
// (external market data, AI synthesis) aren't wired up in Phase 1. Each is shown
// dimmed beneath a "not active yet" scrim via <DeferredOverlay>. The sample
// numbers below exist only to give the dimmed layout realistic shape.

const SAMPLE = "—";

export function ReturnPeriodsDeferred() {
  const periods = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "Hold"];
  return (
    <DeferredOverlay label="Time-weighted returns" hint="Needs market price history">
      <div className="pos-perf-periods">
        <div className="pos-perf-periods-head">
          <span>Return by period</span>
          <span className="pos-eyebrow">% return · CAD-equiv</span>
        </div>
        <div className="pos-perf-periods-row">
          {periods.map((l) => (
            <div key={l} className="pos-perf-pd">
              <div className="pd-lbl">{l}</div>
              <div className="pd-val pos">+0.0%</div>
              <div className="pd-bar pos">
                <i style={{ width: "30%" }} />
              </div>
              <div className="pd-nom">{SAMPLE}</div>
            </div>
          ))}
        </div>
      </div>
    </DeferredOverlay>
  );
}

export function PriceChartDeferred({ p }: { p: PositionDetail }) {
  const ranges = ["1M", "3M", "6M", "1Y", "All"];
  // A faint sample path so the plot area isn't empty under the scrim.
  const pts = Array.from({ length: 40 }, (_, i) => {
    const x = (i / 39) * 100;
    const y = 70 - Math.sin(i / 5) * 18 - i * 0.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <DeferredOverlay label="Live price chart" hint="Needs market data feed">
      <div className="pos-chart-wrap">
        <div className="pos-chart-toolbar">
          <div className="pos-tf">
            {ranges.map((r) => (
              <button key={r} className={r === "6M" ? "on" : ""} type="button">
                {r}
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <div className="pos-overlays">
            <span className="pos-toggle on">
              <i className="dot" style={{ background: "var(--accent)" }} />
              My avg cost
            </span>
            <span className="pos-toggle">
              <i className="dot" style={{ background: "var(--pos)" }} />
              My trades
            </span>
          </div>
        </div>
        <div style={{ width: "100%", height: 280, padding: "8px 12px" }}>
          <svg
            viewBox="0 0 100 80"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
          >
            <polyline
              points={pts}
              fill="none"
              stroke="var(--invest)"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="pos-chart-foot">
          <div className="pos-chart-stats">
            <span>
              <span className="lbl">52W RANGE</span> <span className="v">{SAMPLE}</span>
            </span>
            <span>
              <span className="lbl">FROM HIGH</span> <span className="v">{SAMPLE}</span>
            </span>
            <span>
              <span className="lbl">VS MY COST</span>{" "}
              <span className="v">
                {p.avgNative != null && p.price >= p.avgNative ? "in the money" : "vs cost"}
              </span>
            </span>
            <span>
              <span className="lbl">RSI(14)</span> <span className="v">{SAMPLE}</span>
            </span>
          </div>
        </div>
      </div>
    </DeferredOverlay>
  );
}

export function FundamentalsDeferred({ p }: { p: PositionDetail }) {
  const cells: [string, string][] = p.isFund
    ? [
        ["Net assets", SAMPLE],
        ["Expense ratio", SAMPLE],
        ["Holdings", SAMPLE],
        ["Distribution yield", SAMPLE],
        ["YTD return", SAMPLE],
        ["1Y return", SAMPLE],
        ["3Y return", SAMPLE],
        ["Top sector", SAMPLE],
      ]
    : [
        ["Market cap", SAMPLE],
        ["P/E (TTM)", SAMPLE],
        ["P/E (Fwd)", SAMPLE],
        ["EV/EBITDA", SAMPLE],
        ["Revenue growth", SAMPLE],
        ["EPS growth", SAMPLE],
        ["Gross margin", SAMPLE],
        ["Dividend yield", SAMPLE],
      ];
  return (
    <DeferredOverlay label="Fundamentals" hint="Needs market data provider">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">{p.isFund ? "Fund profile" : "Fundamentals"}</div>
          <div className="panel-meta">SOURCE PENDING</div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="pos-fund-grid">
            {cells.map(([l, v]) => (
              <div key={l} className="pos-fund-cell">
                <div className="lbl">{l}</div>
                <div className="val">{v}</div>
                <div className="sub">&nbsp;</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DeferredOverlay>
  );
}

export function TechnicalsDeferred() {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel">
      <div className="panel-head" onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer" }}>
        <div className="panel-title">Technicals</div>
        <div className="panel-meta">{open ? "HIDE" : "SHOW"} · NOT ACTIVE YET</div>
      </div>
      {open ? (
        <div className="panel-body">
          <DeferredOverlay label="Technical indicators" hint="Needs market data feed">
            <div className="pos-tech-grid">
              {[
                "50-day MA",
                "200-day MA",
                "RSI(14)",
                "52-week range",
                "Beta (3Y)",
                "Avg volume",
              ].map((l) => (
                <div key={l} className="pos-tech-cell">
                  <div className="lbl">{l}</div>
                  <div className="val">{SAMPLE}</div>
                  <div className="sub">&nbsp;</div>
                </div>
              ))}
            </div>
          </DeferredOverlay>
        </div>
      ) : null}
    </div>
  );
}

export function NewsDeferred({ p }: { p: PositionDetail }) {
  const rows = [
    {
      tag: "FUNDAMENTALS",
      title: `${p.name} — headlines will appear here once a news feed is connected`,
    },
    { tag: "ANALYST", title: `Analyst coverage for ${p.symbol}` },
    { tag: "DIVIDEND", title: `Distribution & corporate actions for ${p.symbol}` },
  ];
  return (
    <DeferredOverlay label="News & events" hint="Needs a news provider">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">News &amp; events</div>
          <div className="panel-meta">SOURCE PENDING</div>
        </div>
        <div className="panel-body flush">
          <div className="pos-news-list">
            {rows.map((n, i) => (
              <div className="pos-news-row" key={i}>
                <div className="pos-news-date">
                  <span className="d">—</span>
                  <span className="s">SOURCE</span>
                </div>
                <div className="pos-news-body">
                  <div className="pos-news-title">{n.title}</div>
                  <div className="pos-news-meta">
                    <span className="pos-news-tag">{n.tag}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DeferredOverlay>
  );
}

export function DecisionDeferred({ p }: { p: PositionDetail }) {
  const cases = [
    { k: "bull", lbl: "Bull case", color: "var(--pos)", bg: "var(--pos-bg)" },
    { k: "base", lbl: "Base case", color: "var(--info)", bg: "rgba(96,165,250,0.08)" },
    { k: "bear", lbl: "Bear case", color: "var(--neg)", bg: "var(--neg-bg)" },
  ];
  return (
    <DeferredOverlay label="AI analysis pending review" hint="Deferred for compliance review">
      <div className="pos-cases">
        <div className="pos-cases-prob">
          {cases.map((c) => (
            <div
              key={c.k}
              className="pos-cases-prob-seg"
              style={{ width: "33.3%", background: c.color }}
            >
              <span>{c.lbl.toUpperCase()}</span>
            </div>
          ))}
        </div>
        <div className="pos-cases-grid">
          {cases.map((c) => (
            <div
              key={c.k}
              className={"pos-case " + c.k}
              style={{ "--case-color": c.color, "--case-bg": c.bg } as React.CSSProperties}
            >
              <div className="pos-case-head">
                <span className="pos-case-lbl">{c.lbl}</span>
                <span className="pos-case-pt">—</span>
              </div>
              <ul>
                <li>Scenario analysis for {p.symbol} will appear here.</li>
                <li>Generated commentary is pending compliance review.</li>
              </ul>
              <div className="pos-case-foot">
                <span>SUPPORTED BY</span>
                <span className="ev">—</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DeferredOverlay>
  );
}

export function AiInsightsDeferred({ symbol }: { symbol: string }) {
  return (
    <div className="rail-card">
      <div className="rail-head">
        <div className="rail-title">AI INSIGHTS</div>
        <span className="rail-meta">{symbol}</span>
      </div>
      <DeferredOverlay label="AI insights pending" hint="Deferred for compliance review">
        <div className="pos-insights">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="pos-insight"
              style={
                {
                  "--ins-color": "var(--info)",
                  "--ins-bg": "rgba(96,165,250,0.08)",
                } as React.CSSProperties
              }
            >
              <span className="pos-insight-icon">i</span>
              <div>
                <div className="pos-insight-title">Insight headline</div>
                <div className="pos-insight-body">
                  Position-specific commentary will appear here once analysis is enabled.
                </div>
              </div>
            </div>
          ))}
        </div>
      </DeferredOverlay>
    </div>
  );
}
