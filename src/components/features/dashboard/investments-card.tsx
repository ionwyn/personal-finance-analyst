import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { SymLogo } from "@/components/shared/sym-logo";
import type { InvestmentDashboardData } from "@/lib/investments/types";

export function InvestmentsCard({ data }: { data: InvestmentDashboardData }) {
  const { summary, holdings } = data;
  const top3 = [...holdings].sort((a, b) => b.mvCAD - a.mvCAD).slice(0, 3);
  const remaining = Math.max(0, holdings.length - top3.length);
  const plPos = summary.plCAD >= 0;
  const intPart = Math.floor(summary.portfolioCAD).toLocaleString("en-US");
  const fracPart = (summary.portfolioCAD % 1).toFixed(2).slice(1);

  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--invest)",
              display: "inline-block",
            }}
          />
          <div className="panel-title">
            Investments · {summary.accountCount}{" "}
            {summary.accountCount === 1 ? "account" : "accounts"}
          </div>
        </div>
        <Link
          href={"/app/investments" as never}
          className="panel-meta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--text-2)",
          }}
        >
          View all
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="invest-head">
        <div className="invest-total">
          <div className="v">
            <span className="ccy">$</span>
            {intPart}
            <span className="frac">{fracPart}</span>
          </div>
          <div className="l">Total · CAD</div>
        </div>
        <div className="invest-pl">
          <div className="v">
            <span style={{ color: plPos ? "var(--pos)" : "var(--neg)" }}>
              {plPos ? "+" : "−"}$
              {Math.abs(summary.plCAD).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className={`pct ${plPos ? "pos" : "neg"}`}>
              {plPos ? "+" : "−"}
              {Math.abs(summary.plPct).toFixed(2)}%
            </span>
          </div>
          <div className="l">Open P&amp;L</div>
        </div>
      </div>

      <div>
        {top3.map((h) => {
          const plPos2 = (h.plPct ?? 0) >= 0;
          return (
            <div className="hld-row" key={h.id}>
              <SymLogo symbol={h.symbol} bg={h.logoBg} logoId={h.logoId} />
              <div className="sym">{h.symbol}</div>
              <div className="desc">{h.description}</div>
              <div className="mv">
                $
                {h.mvCAD.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </div>
              {h.plPct == null ? (
                <div className="pl-pct">—</div>
              ) : (
                <div className={`pl-pct ${plPos2 ? "pos" : "neg"}`}>
                  {plPos2 ? "+" : "−"}
                  {Math.abs(h.plPct).toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {remaining > 0 ? (
        <Link href={"/app/investments" as never} className="invest-card-foot">
          {remaining} more positions →
        </Link>
      ) : null}
    </div>
  );
}
