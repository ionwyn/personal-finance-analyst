"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { Button, IconButton } from "@/components/ui";
import type { DiscoveryCandidate } from "@/lib/cycles/utils";
import { RECURRING_DEBUG } from "@/lib/cycles/recurring-debug";

export function DiscoveryPanel({ candidates }: { candidates: DiscoveryCandidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  // DEBUG:recurring remove after rollout — source/fallback summary for the strip.
  const plaidCount = candidates.filter((c) => c.source === "plaid").length;
  const sourceLabel = plaidCount > 0 ? "plaid" : "local";
  const fallbackOn = plaidCount === 0;

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
          merchantPattern: c.merchantPattern ?? c.key,
          plaidStreamId: c.plaidStreamId,
          nextDueDate: c.nextDueDate ?? undefined,
        }),
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
          merchantPattern: c.merchantPattern ?? c.key,
          plaidStreamId: c.plaidStreamId,
        }),
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
        <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} style={{ color: "var(--accent)" }} />
          Discovered recurring expenses
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : `Review ${candidates.length}`}
        </Button>
      </div>
      {open ? (
        <div className="panel-body flush">
          {error ? (
            <div style={{ padding: "8px 14px", color: "var(--neg)", fontSize: 12 }}>{error}</div>
          ) : null}
          {/* DEBUG:recurring remove after rollout */}
          {RECURRING_DEBUG ? (
            <div
              style={{
                padding: "6px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-4)",
                background: "var(--bg-2, rgba(0,0,0,0.03))",
                borderBottom: "1px dashed var(--border)",
              }}
            >
              [DEBUG:recurring] source={sourceLabel} · candidates={candidates.length} · plaid=
              {plaidCount} · fallback={fallbackOn ? "on" : "off"}
            </div>
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
                    <td>
                      <div>{c.suggestedName}</div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 2,
                          fontSize: 10,
                        }}
                      >
                        {c.source === "plaid" ? (
                          <span style={{ color: "var(--accent)" }}>
                            Plaid
                            {c.plaidStatus === "EARLY_DETECTION" ? " · early" : ""}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-4)" }}>Local</span>
                        )}
                        {(c.localOccurrences ?? 0) > 0 ? (
                          <span style={{ color: "var(--text-4)" }}>
                            · seen {c.localOccurrences}× in your data
                          </span>
                        ) : null}
                      </div>
                      {/* DEBUG:recurring remove after rollout */}
                      {RECURRING_DEBUG && c.source === "plaid" ? (
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            color: "var(--text-4)",
                            marginTop: 2,
                          }}
                        >
                          stream={c.plaidStreamId?.slice(-8)} · {c.plaidStatus} · freqRaw=
                          {c.frequencyRaw} · next=
                          {c.predictedNextDate ? c.predictedNextDate.slice(0, 10) : "—"} · local=
                          {c.localOccurrences ?? 0}×
                        </div>
                      ) : null}
                    </td>
                    <td style={{ color: "var(--text-3)", fontSize: 11 }}>
                      {c.frequency}{" "}
                      <span style={{ color: "var(--text-4)" }}>· ~{c.medianIntervalDays}d</span>
                    </td>
                    <td className="num mono">{formatMoney(c.medianAmount)}</td>
                    <td className="num mono">{formatMoney(c.accrualPerCycle)}</td>
                    <td className="num" style={{ color: "var(--text-3)", fontSize: 11 }}>
                      {c.occurrences}×
                    </td>
                    <td className="num">
                      <IconButton
                        label="Confirm as recurring expense"
                        variant="default"
                        disabled={isBusy}
                        onClick={() => confirm(c)}
                        title="Confirm as recurring expense"
                        style={{ marginRight: 4 }}
                      >
                        <Check size={11} />
                      </IconButton>
                      <IconButton
                        label="Dismiss"
                        disabled={isBusy}
                        onClick={() => dismiss(c)}
                        title="Dismiss"
                      >
                        <X size={11} />
                      </IconButton>
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
