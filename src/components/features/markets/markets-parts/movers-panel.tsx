"use client";

import Link from "next/link";

import { SymLogo } from "@/components/shared/sym-logo";
import type { MarketsPortfolioPulse, TapeQuote } from "@/lib/investments/markets-loader";

// ─── "My movers" — today's market move expressed through MY holdings ───────

const money0 = (v: number) =>
  "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
const sign = (v: number) => (v >= 0 ? "+" : "−");

export function MoversPanel({
  portfolio,
  spx,
}: {
  portfolio: MarketsPortfolioPulse | null;
  spx: TapeQuote | undefined;
}) {
  if (!portfolio || portfolio.movers.length === 0) {
    return (
      <div className="panel mkt-movers">
        <div className="panel-head">
          <div className="panel-title">My movers · today</div>
          <div className="panel-meta">HOLDINGS × LIVE QUOTES</div>
        </div>
        <div className="panel-body">
          <div className="mkt-empty">
            No brokerage holdings synced. Link an account to see today&apos;s market expressed
            through your own positions.
          </div>
        </div>
      </div>
    );
  }

  const { dayPlCad, dayPlPct, coveragePct, movers } = portfolio;
  const dayDir = dayPlCad >= 0 ? "pos" : "neg";
  const spxPct = spx?.changePct ?? null;
  const relToSpx = spxPct != null ? dayPlPct - spxPct : null;
  const rows = movers.slice(0, 8);

  return (
    <div className="panel mkt-movers">
      <div className="panel-head">
        <div className="panel-title">My movers · today</div>
        <div className="panel-meta">PRICE MOVE ONLY · EX-FX · CAD-EQUIV</div>
      </div>

      <div className="mkt-pulse">
        <div className="mkt-pulse-main">
          <div className="lbl">EST. DAY P&amp;L</div>
          <div className={"val " + dayDir}>
            {sign(dayPlCad)}
            {money0(dayPlCad)}
            <span className={"pct " + dayDir}>
              {sign(dayPlPct)}
              {Math.abs(dayPlPct).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="mkt-pulse-stats">
          <div>
            <span className="k">VS S&amp;P 500</span>
            <span className={"v " + (relToSpx == null ? "" : relToSpx >= 0 ? "pos" : "neg")}>
              {relToSpx == null ? "—" : sign(relToSpx) + Math.abs(relToSpx).toFixed(2) + " pts"}
            </span>
          </div>
          <div>
            <span className="k">QUOTE COVERAGE</span>
            <span className="v">{coveragePct.toFixed(0)}% of MV</span>
          </div>
        </div>
      </div>

      <div className="panel-body flush">
        <div className="mkt-mover-list">
          {rows.map((m) => {
            const dir = m.changePct == null ? "flat" : m.changePct >= 0 ? "pos" : "neg";
            return (
              <Link
                key={m.symbol}
                href={`/app/portfolio/${encodeURIComponent(m.symbol)}` as never}
                className="mkt-mover-row"
              >
                <SymLogo symbol={m.symbol} bg={m.logoBg} logoId={m.logoId} />
                <div className="mkt-mover-id">
                  <span className="sym">{m.symbol}</span>
                  <span className="name">{m.name}</span>
                </div>
                <div className="mkt-mover-px">
                  {m.price == null
                    ? "—"
                    : "$" +
                      m.price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  <span className="ccy">{m.currency}</span>
                </div>
                <div className={"mkt-mover-chg " + dir}>
                  {m.changePct == null
                    ? "—"
                    : sign(m.changePct) + Math.abs(m.changePct).toFixed(2) + "%"}
                </div>
                <div className={"mkt-mover-pl " + dir}>
                  {m.dayPlCad == null ? "—" : sign(m.dayPlCad) + money0(m.dayPlCad)}
                </div>
                <div className="mkt-mover-wt">
                  <i style={{ width: Math.min(100, m.weight * 2.5) + "%" }} />
                  <span>{m.weight.toFixed(1)}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="mkt-mover-foot">
        Sorted by absolute day move · my CAD impact = position MV × day % (price only)
      </div>
    </div>
  );
}
