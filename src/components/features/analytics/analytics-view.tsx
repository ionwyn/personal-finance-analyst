"use client";

import { InvestmentsTabs } from "@/components/features/investments/investments-tabs";
import type { PortfolioAnalytics } from "@/lib/investments/analytics-loader";

import { CalendarPanel } from "./analytics-parts/calendar-panel";
import { IncomePanel } from "./analytics-parts/income-panel";
import { PerfChart } from "./analytics-parts/perf-chart";
import { RiskPanel } from "./analytics-parts/risk-panel";
import { SectorPanel } from "./analytics-parts/sector-panel";

export function AnalyticsView({ data }: { data: PortfolioAnalytics }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Analytics</div>
            <InvestmentsTabs active="analytics" />
          </div>
          <div className="page-sub">
            PORTFOLIO STATISTICS · CURRENT HOLDINGS AT HISTORICAL PRICES · DESCRIPTIVE, NOT
            PREDICTIVE
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
          <PerfChart series={data.series} fxNote={data.fxNote} />

          <div className="ana-grid">
            {data.risk && <RiskPanel risk={data.risk} />}
            <SectorPanel sectors={data.sectors} />
          </div>

          <div className="ana-grid">
            {data.income && <IncomePanel income={data.income} />}
            <CalendarPanel calendar={data.calendar} />
          </div>

          <div className="foot-note">
            <span>
              Series reprices today&apos;s holdings at historical closes ({data.fxNote}) — it is not
              a time-weighted return and ignores buys, sells &amp; cash flows.
            </span>
            <span>Descriptive statistics — not financial advice</span>
          </div>
        </>
      )}
    </>
  );
}
