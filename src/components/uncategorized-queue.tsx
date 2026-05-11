"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/components/big-number";
import { formatDate } from "@/lib/format";

export type UncategorizedRow = {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  account: string;
};

export type CategoryOption = { id: string; name: string; color: string | null };

export function UncategorizedQueue({
  rows,
  categories
}: {
  rows: UncategorizedRow[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveRule, setSaveRule] = useState<Record<string, boolean>>({});

  if (rows.length === 0) return null;

  async function assign(id: string, categoryId: string) {
    if (!categoryId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}/categorize`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId,
          saveRule: Boolean(saveRule[id])
        })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <div className="panel-title">Uncategorized</div>
        <div className="panel-meta">
          {rows.length} {rows.length === 1 ? "TXN" : "TXNS"} · NEEDS REVIEW
        </div>
      </div>
      <div className="panel-body flush">
        {error ? (
          <div style={{ padding: "8px 14px", color: "var(--neg)", fontSize: 12 }}>{error}</div>
        ) : null}
        {categories.length === 0 ? (
          <div style={{ padding: 14, color: "var(--text-3)", fontSize: 12 }}>
            Create categories in Settings → Categories before assigning.
          </div>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th>Merchant</th>
                <th>Account</th>
                <th className="num" style={{ width: 110 }}>
                  Amount
                </th>
                <th style={{ width: 220 }}>Category</th>
                <th style={{ width: 140 }}>Save rule</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isBusy = busyId === r.id;
                return (
                  <tr key={r.id}>
                    <td className="t-date">{formatDate(r.date)}</td>
                    <td className="t-merchant">{r.merchantName ?? r.name}</td>
                    <td className="t-acct">{r.account}</td>
                    <td
                      className="num mono"
                      style={{ color: r.amount > 0 ? "var(--neg)" : "var(--pos)" }}
                    >
                      {formatMoney(r.amount)}
                    </td>
                    <td>
                      <select
                        disabled={isBusy}
                        defaultValue=""
                        onChange={(e) => assign(r.id, e.target.value)}
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          padding: "3px 6px",
                          fontSize: 12,
                          color: "var(--text)",
                          width: "100%"
                        }}
                      >
                        <option value="" disabled>
                          Choose…
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: "var(--text-3)"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(saveRule[r.id])}
                          onChange={(e) =>
                            setSaveRule((prev) => ({ ...prev, [r.id]: e.target.checked }))
                          }
                          disabled={isBusy}
                        />
                        Auto-apply
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
