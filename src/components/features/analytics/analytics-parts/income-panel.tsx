import type { IncomeStats } from "@/lib/investments/analytics-loader";

import { IncomeChartDynamic } from "./income-panel-dynamic";

// ─── Investment income — received (synced) + forward estimate ──────────────

export function IncomePanel({ income }: { income: IncomeStats }) {
  const data = income.months.map((m) => ({
    label: new Date(m.month + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "short" }),
    amount: m.amountCad,
  }));

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Investment income</div>
        <div className="panel-meta">DIVIDENDS &amp; DISTRIBUTIONS · CAD-EQUIV</div>
      </div>
      <div className="panel-body">
        <div className="pos-divs-stats">
          <div>
            <span className="lbl">GROSS INCOME · TTM</span>
            <span className="val">${income.ttmGrossIncomeCad.toFixed(0)}</span>
          </div>
          <div>
            <span className="lbl">WITHHOLDING TAX</span>
            <span className="val">${income.withholdingTaxCad.toFixed(2)}</span>
          </div>
          <div>
            <span className="lbl">PAYMENTS</span>
            <span className="val">{income.paymentCount}</span>
          </div>
          {income.forwardEstCad != null && (
            <div className="mine">
              <span className="lbl">FWD EST. / YR</span>
              <span className="val">
                ${income.forwardEstCad.toFixed(0)}{" "}
                <em>yields cover {income.forwardCoveragePct.toFixed(0)}% of MV</em>
              </span>
            </div>
          )}
        </div>
        <IncomeChartDynamic data={data} />
      </div>
    </div>
  );
}
