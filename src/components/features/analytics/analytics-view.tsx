import { Suspense } from "react";

import { PortfolioTabs } from "@/components/features/investments/portfolio-tabs";
import { getPortfolioAnalytics } from "@/lib/investments/analytics-loader";

import { AnalyticsBodySkeleton } from "./analytics-parts/analytics-skeletons";
import { CalendarPanel } from "./analytics-parts/calendar-panel";
import { IncomePanel } from "./analytics-parts/income-panel";
import { PerfChartDynamic } from "./analytics-parts/perf-chart-dynamic";
import { RiskPanel } from "./analytics-parts/risk-panel";

// The header (with tabs) renders immediately; the analytics body — gated on the
// expensive flow-aware TWR computation — streams in behind a skeleton. The body
// is one boundary because the risk stats are derived from the TWR series, so they
// must resolve together (no per-panel split that could let them diverge).
export function AnalyticsView({ tenantId }: { tenantId: string | null | undefined }) {
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

      <Suspense fallback={<AnalyticsBodySkeleton />}>
        <AnalyticsBody tenantId={tenantId} />
      </Suspense>
    </>
  );
}

async function AnalyticsBody({ tenantId }: { tenantId: string | null | undefined }) {
  const data = await getPortfolioAnalytics(tenantId);

  if (!data.hasHoldings) {
    return (
      <div className="panel">
        <div className="panel-body">
          <div className="mkt-empty">
            No brokerage holdings synced. Link an account to see portfolio analytics.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PerfChartDynamic series={data.series} fxNote={data.fxNote} mwrPct={data.mwrPct} />

      {data.risk && (
        <div style={{ marginTop: 14 }}>
          <RiskPanel risk={data.risk} />
        </div>
      )}

      <div className="ana-grid">
        {data.income && <IncomePanel income={data.income} />}
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
  );
}
