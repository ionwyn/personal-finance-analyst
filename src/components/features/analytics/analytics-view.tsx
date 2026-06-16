import { PortfolioTabs } from "@/components/features/investments/portfolio-tabs";
import type { PortfolioAnalytics } from "@/lib/investments/analytics-loader";

import { CalendarPanel } from "./analytics-parts/calendar-panel";
import { IncomePanelDynamic } from "./analytics-parts/income-panel-dynamic";
import { PerfChartDynamic } from "./analytics-parts/perf-chart-dynamic";
import { RiskPanel } from "./analytics-parts/risk-panel";

export function AnalyticsView({ data }: { data: PortfolioAnalytics }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Performance</div>
            <PortfolioTabs active="performance" />
          </div>
          <div className="page-sub">
            PORTFOLIO STATISTICS · TIME-WEIGHTED RETURN · DESCRIPTIVE, NOT PREDICTIVE
          </div>
        </div>
      </div>

      {!data.hasHoldings ? (
        <div className="panel">
          <div className="panel-body">
            <div className="mkt-empty">
              No brokerage holdings synced. Link an account to see portfolio analytics.
            </div>
          </div>
        </div>
      ) : (
        <>
          <PerfChartDynamic series={data.series} fxNote={data.fxNote} mwrPct={data.mwrPct} />

          {data.risk && (
            <div className="ana-grid">
              <RiskPanel risk={data.risk} />
            </div>
          )}

          <div className="ana-grid">
            {data.income && <IncomePanelDynamic income={data.income} />}
            <CalendarPanel calendar={data.calendar} />
          </div>

          <div className="foot-note">
            <span>
              Time-weighted return (TWR) — flow-neutralized daily chain-link. FX: {data.fxNote}.
              MWR/XIRR is annualized, investor-perspective.
            </span>
            <span>Descriptive statistics — not financial advice</span>
          </div>
        </>
      )}
    </>
  );
}
