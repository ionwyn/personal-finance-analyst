import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Download } from "lucide-react";

import { BigNumber, formatMoney } from "@/components/big-number";
import { BalanceChart, CashflowChart } from "@/components/charts";
import { CategorySpendPanel } from "@/components/category-spend-panel";
import { InvestmentsCard } from "@/components/investments-card";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { Sparkline } from "@/components/sparkline";
import { SyncAllButton } from "@/components/sync-all-button";
import { formatPlaidDate } from "@/lib/format";
import type { getDashboardData } from "@/lib/analytics";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export function DashboardView({
  data,
  mode
}: {
  data: DashboardData;
  mode: "demo" | "private";
}) {
  const isDemo = mode === "demo";
  const totals = data.totals;
  const insights = data.insights;
  const lastSyncAt = data.plaidItems
    .map((p) => p.lastSyncAt)
    .filter((s): s is string => Boolean(s))
    .sort()
    .pop();

  const subLine = [
    isDemo ? "READ-ONLY · PLAID SANDBOX" : "PRIVATE · LOCAL-FIRST",
    data.plaidItems.length ? `${data.plaidItems.length} INSTITUTIONS` : null,
    totals.accountCount ? `${totals.accountCount} ACCOUNTS` : null,
    lastSyncAt ? `LAST SYNC ${formatRelative(lastSyncAt)}` : null
  ]
    .filter(Boolean)
    .join(" · ");

  if (!data.hasTenant || totals.accountCount === 0) {
    return (
      <>
        <PageHeader title="Overview" subtitle={subLine} actions={!isDemo ? <PlaidLinkButton /> : null} />
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
      <PageHeader
        title="Overview"
        subtitle={subLine}
        actions={
          <>
            {!isDemo ? <SyncAllButton items={data.plaidItems} /> : null}
            <button className="btn" type="button" disabled title="Coming soon">
              <Download size={12} />
              Export
            </button>
            {!isDemo ? <PlaidLinkButton compact /> : null}
          </>
        }
      />

      {/* KPI strip */}
      <div className="kpi-grid">
        <KpiCell
          label="Net worth"
          dot="var(--accent)"
          value={<BigNumber value={totals.currentBalance} />}
          delta={data.deltas.balance}
          versus={data.previousMonthLabel}
          spark={data.sparks.balance}
          sparkColor="var(--accent)"
          subline={`cash ${formatThousands(totals.cashBalance)} · inv ${formatThousands(totals.investmentBalance)}`}
        />
        <KpiCell
          label={`Income · ${data.currentMonthLabel}`}
          dot="var(--pos)"
          value={<BigNumber value={totals.monthlyIncome} />}
          delta={data.deltas.income}
          versus={data.previousMonthLabel}
          spark={data.sparks.income}
          sparkColor="var(--pos)"
          deltaInvert={false}
        />
        <KpiCell
          label={`Spend · ${data.currentMonthLabel}`}
          dot="var(--neg)"
          value={<BigNumber value={totals.monthlySpend} />}
          delta={data.deltas.spend}
          versus={data.previousMonthLabel}
          spark={data.sparks.spend}
          sparkColor="var(--neg)"
          deltaInvert
        />
        <KpiCell
          label="Net cashflow"
          dot="var(--info)"
          value={<BigNumber value={totals.netCashflow} signed />}
          delta={data.deltas.cashflow}
          versus={data.previousMonthLabel}
          spark={data.sparks.cashflow}
          sparkColor="var(--info)"
        />
      </div>

      <div className="dash-grid">
        <div className="col">
          {/* Cashflow */}
          <div className="panel">
            <div className="panel-head">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="panel-title">Cashflow · 6M</div>
                <div className="chart-legend">
                  <span className="lg-item">
                    <i className="sw" style={{ background: "var(--pos)" }} />
                    Income
                  </span>
                  <span className="lg-item">
                    <i className="sw" style={{ background: "var(--neg)" }} />
                    Spending
                  </span>
                </div>
              </div>
              <div className="panel-meta">{monthRangeLabel(data.monthlyCashflow)}</div>
            </div>
            <div className="panel-body" style={{ height: 240 }}>
              <CashflowChart data={data.monthlyCashflow} />
            </div>
          </div>

          {/* Net worth */}
          <div className="panel">
            <div className="panel-head">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="panel-title">Net worth · 6M</div>
                {data.investments.summary.lastSync ? (
                  <span className="chart-anno">
                    <i className="dot" />
                    Investments added {formatMonthDay(data.investments.summary.lastSync)}
                  </span>
                ) : null}
              </div>
              <div className="panel-meta">{netWorthChange(data.balanceHistory)}</div>
            </div>
            <div className="panel-body" style={{ height: 200 }}>
              {data.balanceHistory.length ? (
                <BalanceChart data={data.balanceHistory} />
              ) : (
                <EmptyChart text="No balance snapshots yet" />
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Recent transactions</div>
              {!isDemo ? (
                <Link
                  className="panel-meta"
                  href="/app/transactions"
                  style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-2)" }}
                >
                  View all <ChevronRight size={12} />
                </Link>
              ) : null}
            </div>
            <div className="panel-body flush">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Date</th>
                    <th>Merchant</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.map((t) => (
                    <tr key={t.id}>
                      <td className="t-date">{formatPlaidDate(t.date)}</td>
                      <td className="t-merchant">{t.name}</td>
                      <td className="t-acct">{t.account}</td>
                      <td>
                        <span className="chip">
                          <i className="sw" style={{ background: t.categoryColor }} />
                          {t.category}
                        </span>
                      </td>
                      <td
                        className="num"
                        style={{ color: t.amount < 0 ? "var(--pos)" : "var(--neg)" }}
                      >
                        {formatMoney(-t.amount, { sign: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col">
          {/* Investments — slotted above categories */}
          {data.investments.summary.positionCount > 0 ? (
            <InvestmentsCard data={data.investments} />
          ) : null}

          {/* Pie + categories */}
          <CategorySpendPanel
            spend7d={data.categorySpend7d}
            spend30d={data.categorySpend30d}
            spendMTD={data.categorySpendMTD}
          />

          {/* Insights */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Insights · {data.currentMonthLabel}</div>
              <div className="panel-meta">AUTO</div>
            </div>
            <div className="panel-body">
              <div className="insights-list">
                <div className="row">
                  <span>Avg daily spend</span>
                  <span className="mono tabular">{formatMoney(insights.avgDailySpend)}</span>
                </div>
                <div className="row">
                  <span>Largest expense</span>
                  <span className="mono tabular">
                    {insights.largestExpense ? formatMoney(insights.largestExpense.amount) : "—"}
                  </span>
                </div>
                <div className="row">
                  <span>Subscriptions</span>
                  <span className="mono tabular">
                    {insights.subscriptionsCount
                      ? `${formatMoney(insights.subscriptionsTotal)} · ${insights.subscriptionsCount}`
                      : "—"}
                  </span>
                </div>
                <div className="row">
                  <span>Savings rate</span>
                  <span
                    className="mono tabular"
                    style={{
                      color:
                        insights.savingsRate != null && insights.savingsRate > 0
                          ? "var(--pos)"
                          : insights.savingsRate != null && insights.savingsRate < 0
                            ? "var(--neg)"
                            : undefined
                    }}
                  >
                    {insights.savingsRate != null ? `${insights.savingsRate.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="row">
                  <span>Days remaining</span>
                  <span className="mono tabular">{insights.daysRemaining}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Linked items quick view (private only) */}
          {!isDemo && data.plaidItems.length ? (
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">Linked items</div>
                <Link
                  className="panel-meta"
                  href="/app/accounts"
                  style={{ color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}
                >
                  Manage <ChevronRight size={12} />
                </Link>
              </div>
              <div className="panel-body flush">
                {data.plaidItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: 12
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "var(--text)", fontWeight: 500 }}>
                        {item.institutionName}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--text-4)",
                          marginTop: 2
                        }}
                      >
                        {item.lastSyncAt ? formatRelative(item.lastSyncAt) : "Never synced"}
                      </div>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="foot-note">
        <span>
          {isDemo ? "Demo viewer · Plaid sandbox" : `${totals.transactionCount} transactions in last 6 months`}
        </span>
        <span>↑↓ navigate · ⏎ open · ⌘K command</span>
      </div>
    </>
  );
}

function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{title}</div>
        {subtitle ? <div className="page-sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

function KpiCell({
  label,
  dot,
  value,
  delta,
  versus,
  spark,
  sparkColor,
  deltaInvert = false,
  subline
}: {
  label: string;
  dot: string;
  value: React.ReactNode;
  delta: number | null;
  versus: string;
  spark: number[];
  sparkColor: string;
  deltaInvert?: boolean;
  subline?: string;
}) {
  const deltaIsPositive = delta == null ? null : delta >= 0;
  const isGood = deltaIsPositive == null ? null : deltaInvert ? !deltaIsPositive : deltaIsPositive;
  return (
    <div className="kpi">
      <div className="kpi-label">
        <i className="dot" style={{ background: dot }} />
        {label}
      </div>
      {value}
      <div className="kpi-meta">
        {delta != null ? (
          <span className={`delta ${isGood ? "pos" : "neg"}`}>
            {deltaIsPositive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : (
          <span className="delta" style={{ color: "var(--text-4)" }}>—</span>
        )}
        <span>{subline ?? `vs ${versus}`}</span>
      </div>
      {spark.length > 1 ? (
        <div className="kpi-spark">
          <Sparkline data={spark} color={sparkColor} fill />
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "SYNCING" ? "syncing" : status === "ERROR" ? "error" : "idle";
  return (
    <span className={`status ${cls}`}>
      <i className="pulse" />
      {status}
    </span>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "var(--text-4)",
        fontFamily: "var(--font-mono)",
        fontSize: 11
      }}
    >
      {text}
    </div>
  );
}

function formatRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function monthRangeLabel(months: { month: string }[]) {
  if (!months.length) return "";
  return `${months[0].month.toUpperCase()} — ${months[months.length - 1].month.toUpperCase()}`;
}

function netWorthChange(balanceHistory: { balance: number }[]) {
  if (balanceHistory.length < 2) return "";
  const first = balanceHistory[0].balance;
  const last = balanceHistory[balanceHistory.length - 1].balance;
  const diff = last - first;
  const pct = first ? (diff / Math.abs(first)) * 100 : 0;
  const sign = diff >= 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(diff))} (${sign}${Math.abs(pct).toFixed(1)}%)`;
}

function formatThousands(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatMonthDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
