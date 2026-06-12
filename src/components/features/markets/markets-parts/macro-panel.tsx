"use client";

import { Sparkline } from "@/components/shared/sparkline";
import type { MacroGroup, MacroIndicator } from "@/lib/market-data";

// ─── Macro dashboard — FRED indicator cells with sparklines ────────────────

const GROUP_LABEL: Record<MacroGroup, string> = {
  policy: "POLICY",
  yields: "RATES",
  inflation: "INFLATION",
  labor: "LABOR",
  growth: "GROWTH",
  fx: "FX",
};

const GROUP_COLOR: Record<MacroGroup, string> = {
  policy: "var(--accent)",
  yields: "var(--invest)",
  inflation: "var(--cat-5)",
  labor: "var(--info)",
  growth: "var(--cat-3)",
  fx: "var(--cat-8)",
};

function fmt(v: number | null, ind: MacroIndicator): string {
  if (v == null) return "—";
  const s = v.toLocaleString("en-US", {
    minimumFractionDigits: ind.decimals,
    maximumFractionDigits: ind.decimals,
  });
  return ind.unit === "%" ? s + "%" : s;
}

/** Δ in basis points for % series, pips-free plain for FX. */
function fmtDelta(d: number | null, ind: MacroIndicator): string | null {
  if (d == null || d === 0) return d === 0 ? "unch" : null;
  if (ind.unit === "%") return (d > 0 ? "+" : "−") + Math.abs(d * 100).toFixed(0) + " bps";
  return (d > 0 ? "+" : "−") + Math.abs(d).toFixed(ind.decimals);
}

function asOfLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Default order — the curve panel already shows the full term structure, so
// only headline cells appear here, in a deliberate desk-sheet order.
const US_ORDER = ["FEDFUNDS_U", "CPI_YOY", "UNRATE", "T10Y2Y", "UST10Y", "CA10Y", "USDCAD"];

export function MacroPanel({
  macro,
  title = "Macro dashboard",
  meta = "FRED · ST. LOUIS FED · 12H CACHE",
  order = US_ORDER,
}: {
  macro: MacroIndicator[];
  title?: string;
  meta?: string;
  order?: string[];
}) {
  const cells = order
    .map((id) => macro.find((m) => m.id === id))
    .filter((m): m is MacroIndicator => m != null && m.value != null);

  if (cells.length === 0) return null;

  return (
    <div className="panel mkt-macro">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        <div className="panel-meta">{meta}</div>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        <div className="mkt-macro-grid">
          {cells.map((m) => {
            const yoy = fmtDelta(m.changeYoY, m);
            return (
              <div key={m.id} className="mkt-macro-cell">
                <div className="head">
                  <span className="grp" style={{ color: GROUP_COLOR[m.group] }}>
                    {GROUP_LABEL[m.group]}
                  </span>
                  <span className="asof">{asOfLabel(m.asOf)}</span>
                </div>
                <div className="lbl">{m.label}</div>
                <div className="val">{fmt(m.value, m)}</div>
                <div className="spark">
                  <Sparkline
                    data={m.spark.map((p) => p.value)}
                    color={GROUP_COLOR[m.group]}
                    width={120}
                    height={26}
                    fill
                  />
                </div>
                <div className="delta">
                  {yoy != null && (
                    <span
                      className={
                        "chip " +
                        ((m.changeYoY ?? 0) > 0 ? "up" : (m.changeYoY ?? 0) < 0 ? "down" : "")
                      }
                    >
                      {yoy} <span className="per">/1Y</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
