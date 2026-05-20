import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatMoney, formatPlaidDate } from "@/lib/format";

import type { DashboardData } from "./types";

export function RecentTransactionsPanel({
  data,
  isDemo,
}: {
  data: DashboardData;
  isDemo: boolean;
}) {
  return (
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
                <td className="num" style={{ color: t.amount < 0 ? "var(--pos)" : "var(--neg)" }}>
                  {formatMoney(-t.amount, { sign: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
