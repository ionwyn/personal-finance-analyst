"use client";

import type { TapeQuote } from "@/lib/investments/markets-loader";

// ─── Index tape — the pulse strip across the top of the Markets sheet ──────

const KIND_LABEL: Record<string, string> = {
  index: "EQUITY",
  vol: "RISK",
  fx: "FX",
  commodity: "CMDTY",
  crypto: "CRYPTO",
};

function fmtValue(v: number | null, decimals: number): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function Tape({ tape }: { tape: TapeQuote[] }) {
  return (
    <div className="mkt-tape" role="list" aria-label="Market index tape">
      {tape.map((t) => {
        const dir = t.changePct == null ? "flat" : t.changePct >= 0 ? "pos" : "neg";
        return (
          <div key={t.id} className="mkt-tape-cell" role="listitem">
            <div className="mkt-tape-head">
              <span className="lbl">{t.label}</span>
              <span className="kind">{KIND_LABEL[t.kind] ?? ""}</span>
            </div>
            <div className="mkt-tape-val">{fmtValue(t.value, t.decimals)}</div>
            <div className={"mkt-tape-chg " + dir}>
              {t.changePct == null ? (
                "—"
              ) : (
                <>
                  <span className="arrow">{t.changePct >= 0 ? "▲" : "▼"}</span>
                  {Math.abs(t.changePct).toFixed(2)}%
                  {t.change != null && (
                    <span className="abs">
                      {(t.change >= 0 ? "+" : "−") + fmtValue(Math.abs(t.change), t.decimals)}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
