import { Download } from "lucide-react";

import { CategorySpendPanel } from "@/components/features/dashboard/category-spend-panel";
import { OfflineSnapshotWriter } from "@/components/pwa/offline-snapshot-writer";
import styles from "./dashboard-view.module.scss";
import { CashflowPanel, NetWorthPanel } from "@/components/features/dashboard/chart-panels";
import { InsightsPanel } from "@/components/features/dashboard/insights-panel";
import { DashboardKpiStrip } from "@/components/features/dashboard/kpi-strip";
import { LinkedItemsPanel } from "@/components/features/dashboard/linked-items-panel";
import { RecentTransactionsPanel } from "@/components/features/dashboard/recent-transactions-panel";
import type { DashboardData, DashboardMode } from "@/components/features/dashboard/types";
import { InvestmentsCard } from "@/components/features/dashboard/investments-card";
import { SupplyChainRiskPanel } from "@/components/features/dashboard/supply-chain-risk-panel";
import { PlaidLinkButton } from "@/components/actions/plaid-link-button";
import { Button, PageHeader } from "@/components/ui";
import { SyncAllButton } from "@/components/actions/sync-all-button";
import { formatRelativeTime } from "@/lib/format";

export function DashboardView({ data, mode }: { data: DashboardData; mode: DashboardMode }) {
  const isDemo = mode === "demo";
  const totals = data.totals;
  const lastSyncAt = data.plaidItems
    .map((p) => p.lastSyncAt)
    .filter((s): s is string => Boolean(s))
    .sort()
    .pop();

  const subLine = [
    isDemo ? "READ-ONLY · PLAID SANDBOX" : "PRIVATE · LOCAL-FIRST",
    data.plaidItems.length ? `${data.plaidItems.length} INSTITUTIONS` : null,
    totals.accountCount ? `${totals.accountCount} ACCOUNTS` : null,
    lastSyncAt ? `LAST SYNC ${formatRelativeTime(lastSyncAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!data.hasTenant || totals.accountCount === 0) {
    return (
      <>
        <PageHeader
          title="Overview"
          subtitle={subLine}
          actions={!isDemo ? <PlaidLinkButton /> : null}
        />
        <section className="empty-state">
          <h2>{isDemo ? "Demo data has not been seeded yet" : "No accounts linked yet"}</h2>
          <p>
            {isDemo
              ? "Run the demo seed after configuring Plaid sandbox credentials."
              : "Connect a Plaid account to start syncing transactions and balance snapshots."}
          </p>
          {!isDemo ? <PlaidLinkButton /> : null}
        </section>
      </>
    );
  }

  return (
    <>
      <OfflineSnapshotWriter kind="dashboard" data={data} mode={mode} />
      <PageHeader
        title="Overview"
        subtitle={subLine}
        actions={
          <>
            {!isDemo ? (
              <SyncAllButton
                items={data.plaidItems}
                hasSnaptrade={data.investments.summary.connectionCount > 0}
              />
            ) : null}
            <Button disabled title="Coming soon" icon={<Download size={12} />}>
              Export
            </Button>
            {!isDemo ? <PlaidLinkButton compact /> : null}
          </>
        }
      />

      <DashboardKpiStrip data={data} />

      <div className={styles.dashGrid}>
        <div className={styles.col}>
          <CashflowPanel data={data} />
          <NetWorthPanel data={data} />
          <RecentTransactionsPanel data={data} isDemo={isDemo} />
        </div>

        <div className={styles.col}>
          {data.investments.summary.positionCount > 0 ? (
            <InvestmentsCard data={data.investments} />
          ) : null}
          {!isDemo && data.investments.summary.positionCount > 0 ? <SupplyChainRiskPanel /> : null}
          <CategorySpendPanel
            spend7d={data.categorySpend7d}
            spend30d={data.categorySpend30d}
            spendMTD={data.categorySpendMTD}
          />
          <InsightsPanel data={data} />
          {!isDemo ? <LinkedItemsPanel data={data} /> : null}
        </div>
      </div>

      <div className="foot-note">
        <span>
          {isDemo
            ? "Demo viewer · Plaid sandbox"
            : `${totals.transactionCount} transactions in last 6 months`}
        </span>
        <span>↑↓ navigate · ⏎ open · ⌘K command</span>
      </div>
    </>
  );
}
