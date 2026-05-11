import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/components/big-number";
import { ExportCsvButton, TransactionsToolbar } from "@/components/transactions-toolbar";
import { getDashboardData, getTransactionsForTenant } from "@/lib/analytics";
import { authOptions } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    category?: string;
    account?: string;
  }>;
};

export default async function TransactionsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const params = await searchParams;
  const tenant = await getUserTenant(session.user.id);
  const slug = tenant?.slug ?? "personal";

  const [transactions, dashboard] = await Promise.all([
    getTransactionsForTenant({
      tenantSlug: slug,
      q: params.q,
      from: params.from,
      to: params.to,
      category: params.category,
      account: params.account
    }),
    getDashboardData(slug)
  ]);

  const totalCount = dashboard.totals.transactionCount;
  const income = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const spend = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const net = income - spend;

  const categoryOptions = uniqueSorted(transactions.map((t) => t.category));
  const accountOptions = uniqueSorted(transactions.map((t) => t.account));
  const categoryColors: Record<string, string> = {};
  for (const t of transactions) {
    categoryColors[t.category] = t.categoryColor;
  }

  const subLine = [
    `${transactions.length} OF ${totalCount} ROWS`,
    rangeLabel(params.from, params.to)
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell
      mode="private"
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        handle: session.user.email ?? undefined
      }}
    >
      <div className="page-header">
        <div>
          <div className="page-title">Transactions</div>
          <div className="page-sub">{subLine}</div>
        </div>
        <div className="page-actions">
          <ExportCsvButton />
        </div>
      </div>

      <div className="summary-bar">
        <div className="cell">
          <div className="lbl">Rows</div>
          <div className="val">{transactions.length}</div>
        </div>
        <div className="cell">
          <div className="lbl">Income</div>
          <div className="val pos">+{formatMoney(income)}</div>
        </div>
        <div className="cell">
          <div className="lbl">Spending</div>
          <div className="val neg">−{formatMoney(spend)}</div>
        </div>
        <div className="cell">
          <div className="lbl">Net</div>
          <div className="val" style={{ color: net >= 0 ? "var(--pos)" : "var(--neg)" }}>
            {net >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(net))}
          </div>
        </div>
      </div>

      <TransactionsToolbar
        initialQuery={params.q}
        initialFrom={params.from}
        initialTo={params.to}
        initialCategory={params.category}
        initialAccount={params.account}
        categoryOptions={categoryOptions}
        accountOptions={accountOptions}
        categoryColors={categoryColors}
      />

      <div className="panel">
        <div
          className="panel-body flush"
          style={{ maxHeight: "calc(100vh - 360px)", overflow: "auto" }}
        >
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th>Merchant</th>
                <th>Account</th>
                <th>Category</th>
                <th className="num" style={{ width: 130 }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="t-date">{formatDate(t.date)}</td>
                  <td className="t-merchant">
                    {t.name}
                    {t.pending ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-4)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em"
                        }}
                      >
                        Pending
                      </span>
                    ) : null}
                  </td>
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
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-4)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11
                    }}
                  >
                    NO MATCHING TRANSACTIONS
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="foot-note">
        <span>
          Showing {transactions.length} of {totalCount} · sorted by date desc
        </span>
        <span>↑↓ navigate · ⏎ open · / search</span>
      </div>
    </AppShell>
  );
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function rangeLabel(from?: string, to?: string) {
  if (!from && !to) return null;
  const fmt = (s?: string) => {
    if (!s) return "—";
    const d = new Date(`${s}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  };
  return `${fmt(from)} — ${fmt(to)}`;
}
