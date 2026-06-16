import { SectorPanelDynamic } from "@/components/features/analytics/analytics-parts/sector-panel-dynamic";
import { SnapTradeLinkButton, SnapTradeSyncButton } from "@/components/actions/snaptrade-actions";
import { MoversPanel } from "@/components/features/markets/markets-parts/movers-panel";
import { formatRelativeTime } from "@/lib/format";
import type { PortfolioPulse } from "@/lib/investments/markets-loader";
import type { InvestmentDashboardData } from "@/lib/investments/types";

import { AccountsPanel } from "./investments-parts/accounts-panel";
import { AllocationPanels } from "./investments-parts/allocation-panels";
import { CashBalancesPanel } from "./investments-parts/cash-balances-panel";
import { ConnectionHealthPanel } from "./investments-parts/connection-health-panel";
import { SummaryBar } from "./investments-parts/summary-bar";
import { PortfolioTabs } from "./portfolio-tabs";

export function InvestmentsView({
  data,
  pulse,
}: {
  data: InvestmentDashboardData;
  pulse: PortfolioPulse;
}) {
  const { summary, accounts, connections, allocByType, allocByCcy, sectors } = data;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Portfolio</div>
            <PortfolioTabs active="overview" />
          </div>
          <div className="page-sub">
            {summary.accountCount} {summary.accountCount === 1 ? "ACCOUNT" : "ACCOUNTS"} ·{" "}
            {summary.positionCount} POSITIONS · LAST SYNC{" "}
            {formatRelativeTime(summary.lastSync).toUpperCase()} · SNAPTRADE · OK
          </div>
        </div>
        <div className="page-actions">
          <SnapTradeSyncButton />
          <SnapTradeLinkButton compact />
        </div>
      </div>

      <SummaryBar summary={summary} contributions={data.contributions} />

      <AllocationPanels
        allocByType={allocByType}
        allocByCcy={allocByCcy}
        fxUSDtoCAD={summary.fxUSDtoCAD}
      />

      {sectors.length > 0 && <SectorPanelDynamic sectors={sectors} />}

      <MoversPanel portfolio={pulse.portfolio} spx={pulse.spx ?? undefined} />

      <ConnectionHealthPanel connections={connections} />

      <AccountsPanel accounts={accounts} />

      <CashBalancesPanel cashByCcy={summary.cashByCcy} />

      <div className="foot-note">
        <span>SnapTrade positions cached {formatRelativeTime(summary.lastSync)}</span>
        <span>
          {summary.omittedPositionCount > 0
            ? `${summary.omittedPositionCount} positions omitted`
            : ""}
        </span>
      </div>
    </>
  );
}
