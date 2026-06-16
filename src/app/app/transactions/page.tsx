import {
  ExportCsvButton,
  TransactionsToolbar,
} from "@/components/features/transactions/transactions-toolbar";
import { getTransactionsForTenant } from "@/lib/analytics";
import { formatMoney, formatPlaidDate } from "@/lib/format";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    category?: string;
    account?: string;
    bucket?: string;
    pending?: string;
    amountMin?: string;
    amountMax?: string;
  }>;
};

export default async function TransactionsPage({ searchParams }: Props) {
  const { tenantSlug: slug } = await getSessionTenant();
  const params = await searchParams;

  const today = new Date();
  const defaultTo = today.toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const defaultFrom = thirtyDaysAgo.toISOString().split("T")[0];

  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;

  const { rows: transactions, total: totalCount } = await getTransactionsForTenant({
    tenantSlug: slug,
    q: params.q,
    from,
    to,
    category: params.category,
    account: params.account,
    bucket: params.bucket,
    pending: params.pending,
    amountMin: params.amountMin,
    amountMax: params.amountMax,
  });

  const income = transactions
    .filter((t) => t.bucket === "income")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const spend = transactions
    .filter((t) => t.bucket === "spending")
    .reduce((s, t) => s + t.amount, 0);
  const transfersCount = transactions.filter(
    (t) => t.bucket === "transfer" || t.bucket === "settlement" || t.bucket === "savings"
  ).length;
  const net = income - spend;

  const categoryOptions = uniqueSorted(transactions.map((t) => t.category));
  const accountOptions = uniqueSorted(transactions.map((t) => t.account));
  const categoryColors: Record<string, string> = {};
  for (const t of transactions) {
    categoryColors[t.category] = t.categoryColor;
  }

  const subLine = [
    `${transactions.length} OF ${totalCount} ROWS`,
    transfersCount > 0 ? `${transfersCount} EXCLUDED` : null,
    rangeLabel(from, to),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Transactions</div>
          <div className="page-sub">{subLine}</div>
        </div>
        <div className="page-actions">
          <ExportCsvButton from={from} to={to} />
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
        initialFrom={from}
        initialTo={to}
        initialCategory={params.category}
        initialAccount={params.account}
        initialBucket={params.bucket}
        initialPending={params.pending}
        initialAmountMin={params.amountMin}
        initialAmountMax={params.amountMax}
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
              {transactions.map((t) => {
                const excluded =
                  t.bucket === "transfer" || t.bucket === "settlement" || t.bucket === "savings";
                return (
                  <tr key={t.id} style={excluded ? { opacity: 0.6 } : undefined}>
                    <td className="t-date">{formatPlaidDate(t.authorizedDate)}</td>
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
                            letterSpacing: "0.06em",
                          }}
                        >
                          Pending
                        </span>
                      ) : null}
                      {excluded ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-4)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                          title="Excluded from spending/income totals"
                        >
                          {t.bucket}
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
                );
              })}
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-4)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
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
    </>
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
