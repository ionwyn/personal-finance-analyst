import { formatMoney, formatPercent } from "@/lib/format";
import type { ContributionData, InvestmentDashboardData } from "@/lib/investments/types";

export function SummaryBar({
  summary,
  contributions,
}: {
  summary: InvestmentDashboardData["summary"];
  contributions: ContributionData;
}) {
  const plPos = summary.plCAD >= 0;
  return (
    <div className="summary-bar">
      <div className="cell">
        <div className="lbl">Portfolio · CAD</div>
        <div className="val">{formatMoney(summary.portfolioCAD)}</div>
      </div>
      <div className="cell">
        <div className="lbl">Open P&amp;L</div>
        <div className="val" style={{ color: plPos ? "var(--pos)" : "var(--neg)" }}>
          {formatMoney(summary.plCAD, { sign: true })}
        </div>
      </div>
      <div className="cell">
        <div className="lbl">Open P&amp;L %</div>
        <div className="val" style={{ color: plPos ? "var(--pos)" : "var(--neg)" }}>
          {formatPercent(summary.plPct)}
        </div>
      </div>
      <div className="cell">
        <div className="lbl">Net invested</div>
        <div className="val">{formatMoney(contributions.lifetimeNetCad)}</div>
      </div>
      <div className="cell">
        <div className="lbl">Cash · CAD-eq.</div>
        <div className="val">{formatMoney(summary.cashCAD)}</div>
      </div>
    </div>
  );
}
