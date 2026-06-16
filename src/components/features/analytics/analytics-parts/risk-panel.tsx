import type { RiskStats } from "@/lib/investments/analytics-loader";

// ─── Risk & concentration statistics ────────────────────────────────────────

function fmtDay(d: { date: string; pct: number } | null): { v: string; sub: string } {
  if (!d) return { v: "—", sub: "" };
  const label = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return { v: (d.pct >= 0 ? "+" : "−") + Math.abs(d.pct).toFixed(2) + "%", sub: label };
}

export function RiskPanel({ risk }: { risk: RiskStats }) {
  const best = fmtDay(risk.bestDay);
  const worst = fmtDay(risk.worstDay);

  const cells: { lbl: string; v: string; sub: string; tone?: "pos" | "neg" }[] = [
    {
      lbl: "Volatility (ann.)",
      v: risk.annVolPct != null ? risk.annVolPct.toFixed(1) + "%" : "—",
      sub: "stdev of daily returns × √252",
    },
    {
      lbl: "Beta vs S&P 500",
      v: risk.beta != null ? risk.beta.toFixed(2) : "—",
      sub: risk.beta != null ? (risk.beta > 1 ? "amplifies the index" : "dampens the index") : "",
    },
    {
      lbl: "Sharpe (1Y, ex-post)",
      v: risk.sharpe != null ? risk.sharpe.toFixed(2) : "—",
      sub: "vs 3M T-bill",
    },
    {
      lbl: "Max drawdown",
      v: risk.maxDrawdownPct != null ? "−" + Math.abs(risk.maxDrawdownPct).toFixed(1) + "%" : "—",
      sub: "peak to trough in window",
      tone: "neg",
    },
    { lbl: "Best day", v: best.v, sub: best.sub, tone: "pos" },
    { lbl: "Worst day", v: worst.v, sub: worst.sub, tone: "neg" },
    {
      lbl: "Top-5 concentration",
      v: risk.top5WeightPct.toFixed(0) + "%",
      sub: `of ${risk.holdingsCount} holdings`,
    },
    {
      lbl: "Effective N",
      v: risk.effectiveN != null ? risk.effectiveN.toFixed(1) : "—",
      sub: "1 / Σ weight² — diversification",
    },
  ];

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Risk &amp; concentration</div>
        <div className="panel-meta">{risk.windowDays} TRADING DAYS · DESCRIPTIVE STATS</div>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        <div className="ana-risk-grid">
          {cells.map((c) => (
            <div key={c.lbl} className="ana-risk-cell">
              <div className="lbl">{c.lbl}</div>
              <div className={"val " + (c.tone ?? "")}>{c.v}</div>
              <div className="sub">{c.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
