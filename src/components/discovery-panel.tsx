"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";

import { formatMoney } from "@/components/big-number";
import type { DiscoveryCandidate } from "@/lib/cycles/discovery";

export function DiscoveryPanel({ candidates }: { candidates: DiscoveryCandidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  async function confirm(c: DiscoveryCandidate) {
    setBusyKey(c.key);
    setError(null);
    try {
      const res = await fetch("/api/cycles/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: c.key,
          name: c.suggestedName,
          amount: c.medianAmount,
          frequency: c.frequency,
          merchantPattern: c.key
        })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to confirm");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setBusyKey(null);
    }
  }

  async function dismiss(c: DiscoveryCandidate) {
    setBusyKey(c.key);
    setError(null);
    try {
      const res = await fetch("/api/cycles/discovery", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: c.key,
          name: c.suggestedName,
          amount: c.medianAmount,
          frequency: c.frequency,
          merchantPattern: c.key
        })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to dismiss");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to dismiss");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="panel" style={{ borderColor: "var(--accent-dim)" }}>
      <div className="panel-head">
        <div
          className="panel-title"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Sparkles size={13} style={{ color: "var(--accent)" }} />
          Discovered recurring expenses
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide" : `Review ${candidates.length}`}
        </button>
      </div>
      {open ? (
        <div className="panel-body flush">
          {error ? (
            <div style={{ padding: "8px 14px", color: "var(--neg)", fontSize: 12 }}>{error}</div>
          ) : null}
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Frequency</th>
                <th className="num">Amount</th>
                <th className="num">Accrual</th>
                <th className="num">Seen</th>
                <th style={{ width: 130 }}></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const isBusy = busyKey === c.key || pending;
                return (
                  <tr key={c.key}>
                    <td>{c.suggestedName}</td>
                    <td style={{ color: "var(--text-3)", fontSize: 11 }}>
                      {c.frequency}{" "}
                      <span style={{ color: "var(--text-4)" }}>
                        · ~{c.medianIntervalDays}d
                      </span>
                    </td>
                    <td className="num mono">{formatMoney(c.medianAmount)}</td>
                    <td className="num mono">{formatMoney(c.accrualPerCycle)}</td>
                    <td className="num" style={{ color: "var(--text-3)", fontSize: 11 }}>
                      {c.occurrences}×
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={isBusy}
                        onClick={() => confirm(c)}
                        title="Confirm as recurring expense"
                        style={{ marginRight: 4 }}
                      >
                        <Check size={11} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        disabled={isBusy}
                        onClick={() => dismiss(c)}
                        title="Dismiss"
                      >
                        <X size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
