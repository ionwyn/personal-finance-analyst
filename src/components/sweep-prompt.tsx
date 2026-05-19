"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";

import { formatMoney } from "@/components/big-number";

export function SweepPrompt({
  suggestedAmount,
  alreadySwept,
}: {
  suggestedAmount: number;
  alreadySwept: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [amount, setAmount] = useState<number>(Math.max(0, suggestedAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!open) return null;
  if (alreadySwept > 0) {
    return (
      <section className="panel" style={{ marginBottom: 16, borderColor: "var(--pos)" }}>
        <div className="panel-body" style={{ fontSize: 12 }}>
          <strong style={{ color: "var(--pos)" }}>Sweep recorded.</strong>{" "}
          {formatMoney(alreadySwept)} moved this cycle. The next Plaid sync will reconcile it with
          the real debit.
        </div>
      </section>
    );
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles/sweep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to record sweep");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record sweep");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles/sweep", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to skip");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to skip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="panel"
      style={{
        marginBottom: 16,
        borderColor: "var(--accent)",
        background: "var(--accent-dim)",
      }}
    >
      <div className="panel-head">
        <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wallet size={13} style={{ color: "var(--accent)" }} />
          End-of-cycle sweep
        </div>
      </div>
      <div className="panel-body" style={{ fontSize: 13 }}>
        <p style={{ marginTop: 0, color: "var(--text-2)" }}>
          Cycle closes today. Recommended sweep to Wealthsimple:{" "}
          <strong className="mono">{formatMoney(suggestedAmount)}</strong>.
        </p>
        {error ? (
          <div style={{ color: "var(--neg)", fontSize: 12, marginBottom: 8 }}>{error}</div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Amount
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            disabled={busy}
            className="mono"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "4px 8px",
              color: "var(--text)",
              width: 140,
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" disabled={busy || amount <= 0} onClick={confirm}>
            Confirm sweep
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={skip}>
            Skip this cycle
          </button>
        </div>
      </div>
    </section>
  );
}
