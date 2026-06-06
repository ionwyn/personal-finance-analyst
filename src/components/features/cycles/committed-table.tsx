"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Hourglass, X } from "lucide-react";

import { formatMoney, formatUtcDate } from "@/lib/format";
import type { CommittedStatus } from "@/lib/cycles/getCurrentCycle";

/** Plain, serializable shape for the client boundary (no Prisma.Decimal / Date). */
export type CommittedRow = {
  id: string;
  name: string;
  frequency: string;
  status: CommittedStatus;
  settled: boolean;
  amount: number;
  accrual: number;
  dueDateMs: number | null;
  settledMethod: string | null;
  /** Whether this expense already has an auto-match pattern (hides the rule nudge). */
  hasPattern: boolean;
};

type Candidate = {
  id: string;
  name: string;
  amount: number | string;
  date: string;
  pending: boolean;
};

type Nudge = { recurringExpenseId: string; pattern: string };

const METHODS = ["e-transfer", "cheque", "cash", "other"] as const;

function StatusBadge({ row }: { row: CommittedRow }) {
  const config: Record<CommittedStatus, { label: string; Icon: typeof Clock; color: string }> = {
    debited: { label: "Debited", Icon: CheckCircle2, color: "var(--pos)" },
    paid: { label: "Paid", Icon: CheckCircle2, color: "var(--pos)" },
    accrued: { label: "Accrued", Icon: Hourglass, color: "var(--text-3)" },
    upcoming: { label: "Upcoming", Icon: Clock, color: "var(--info)" },
  };
  const { label, Icon, color } = config[row.status];
  const due = row.dueDateMs != null ? formatUtcDate(new Date(row.dueDateMs)) : null;

  // Show the scheduled date on upcoming/accrued; show the method on a manual Paid.
  let suffix: string | null = null;
  if (row.status === "paid" && row.settledMethod) suffix = row.settledMethod;
  else if ((row.status === "upcoming" || row.status === "accrued") && due) suffix = due;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color,
        fontFamily: "var(--font-mono)",
      }}
    >
      <Icon size={11} />
      {label}
      {suffix ? <span style={{ color: "var(--text-3)" }}>· {suffix}</span> : null}
    </span>
  );
}

export function CommittedTable({ rows }: { rows: CommittedRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 14, color: "var(--text-3)", fontSize: 12 }}>
        No active recurring expenses. Add them in Settings → Recurring expenses.
      </div>
    );
  }

  function close() {
    setOpenId(null);
    setNudge(null);
    setError(null);
  }

  async function openPicker(row: CommittedRow) {
    if (openId === row.id) {
      close();
      return;
    }
    setOpenId(row.id);
    setNudge(null);
    setCandidates([]);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/cycles/settlements?recurringExpenseId=${encodeURIComponent(row.id)}`
      );
      if (!res.ok) throw new Error("Failed to load candidates");
      const json = (await res.json()) as { candidates: Candidate[] };
      setCandidates(json.candidates);
    } catch {
      setError("Couldn't load matching transactions.");
    } finally {
      setLoading(false);
    }
  }

  async function settle(
    recurringExpenseId: string,
    body: { transactionId?: string; method?: string }
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringExpenseId, ...body }),
      });
      if (!res.ok) throw new Error("Failed to settle");
      router.refresh();
      return true;
    } catch {
      setError("Couldn't save. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function linkTransaction(row: CommittedRow, candidate: Candidate) {
    const ok = await settle(row.id, { transactionId: candidate.id });
    if (!ok) return;
    // Offer to auto-match this merchant next cycle — only when no rule exists yet.
    if (!row.hasPattern) {
      setNudge({ recurringExpenseId: row.id, pattern: candidate.name.toUpperCase().trim() });
    } else {
      close();
    }
  }

  async function markPaid(row: CommittedRow, method: string) {
    const ok = await settle(row.id, { method });
    if (ok) close();
  }

  async function undo(recurringExpenseId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles/settlements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringExpenseId }),
      });
      if (!res.ok) throw new Error("Failed to undo");
      router.refresh();
    } catch {
      setError("Couldn't undo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRule(recurringExpenseId: string, pattern: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/recurring-expenses/${recurringExpenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantPattern: pattern }),
      });
      if (!res.ok) throw new Error("Failed to save rule");
      close();
      router.refresh();
    } catch {
      setError("Couldn't save the rule. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <table className="table" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Frequency</th>
          <th>Status</th>
          <th className="num">Amount</th>
          <th className="num">Accrual</th>
          <th className="num" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const open = openId === row.id;
          const rowNudge = nudge && nudge.recurringExpenseId === row.id ? nudge : null;
          return (
            <FragmentRow
              key={row.id}
              row={row}
              open={open}
              loading={loading}
              busy={busy}
              error={open ? error : null}
              candidates={candidates}
              nudge={rowNudge}
              onToggle={() => openPicker(row)}
              onLink={(candidate) => linkTransaction(row, candidate)}
              onMarkPaid={(method) => markPaid(row, method)}
              onUndo={() => undo(row.id)}
              onSaveRule={(pattern) => saveRule(row.id, pattern)}
              onDismissNudge={close}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function FragmentRow({
  row,
  open,
  loading,
  busy,
  error,
  candidates,
  nudge,
  onToggle,
  onLink,
  onMarkPaid,
  onUndo,
  onSaveRule,
  onDismissNudge,
}: {
  row: CommittedRow;
  open: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  candidates: Candidate[];
  nudge: Nudge | null;
  onToggle: () => void;
  onLink: (candidate: Candidate) => void;
  onMarkPaid: (method: string) => void;
  onUndo: () => void;
  onSaveRule: (pattern: string) => void;
  onDismissNudge: () => void;
}) {
  return (
    <>
      <tr>
        <td>{row.name}</td>
        <td style={{ color: "var(--text-3)", fontSize: 11 }}>{row.frequency}</td>
        <td>
          <StatusBadge row={row} />
        </td>
        <td className="num mono">{formatMoney(row.amount)}</td>
        <td className="num mono">{formatMoney(row.accrual)}</td>
        <td className="num">
          {row.status === "paid" ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={onUndo}
              disabled={busy}
              style={{ fontSize: 11 }}
            >
              Undo
            </button>
          ) : row.status === "debited" ? null : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={onToggle}
              disabled={busy}
              style={{ fontSize: 11 }}
            >
              {open ? "Close" : "Settle"}
            </button>
          )}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} style={{ background: "var(--bg-2, rgba(0,0,0,0.02))", padding: 12 }}>
            {nudge ? (
              <RuleNudge
                expenseName={row.name}
                initialPattern={nudge.pattern}
                busy={busy}
                error={error}
                onSave={onSaveRule}
                onDismiss={onDismissNudge}
              />
            ) : (
              <SettlePicker
                loading={loading}
                busy={busy}
                error={error}
                candidates={candidates}
                onLink={onLink}
                onMarkPaid={onMarkPaid}
              />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SettlePicker({
  loading,
  busy,
  error,
  candidates,
  onLink,
  onMarkPaid,
}: {
  loading: boolean;
  busy: boolean;
  error: string | null;
  candidates: Candidate[];
  onLink: (candidate: Candidate) => void;
  onMarkPaid: (method: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-3)",
            marginBottom: 6,
          }}
        >
          Link a transaction (near the due date)
        </div>
        {loading ? (
          <div style={{ color: "var(--text-3)" }}>Loading matches…</div>
        ) : candidates.length === 0 ? (
          <div style={{ color: "var(--text-3)" }}>No nearby transactions found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onLink(c)}
                disabled={busy}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "6px 8px",
                  background: "var(--bg, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: busy ? "default" : "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "var(--text)" }}>{c.name}</span>
                  <span style={{ color: "var(--text-3)", fontSize: 11 }}>
                    {formatUtcDate(new Date(c.date))}
                    {c.pending ? " · pending" : ""}
                  </span>
                </span>
                <span className="mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(Number(c.amount))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-3)",
            marginBottom: 6,
          }}
        >
          Paid another way
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              className="btn btn-sm"
              onClick={() => onMarkPaid(m)}
              disabled={busy}
              style={{ fontSize: 11, textTransform: "capitalize" }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div style={{ color: "var(--neg)", display: "flex", alignItems: "center", gap: 4 }}>
          <X size={12} /> {error}
        </div>
      ) : null}
    </div>
  );
}

function RuleNudge({
  expenseName,
  initialPattern,
  busy,
  error,
  onSave,
  onDismiss,
}: {
  expenseName: string;
  initialPattern: string;
  busy: boolean;
  error: string | null;
  onSave: (pattern: string) => void;
  onDismiss: () => void;
}) {
  const [pattern, setPattern] = useState(initialPattern);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--pos)" }}>
        <CheckCircle2 size={13} /> Marked {expenseName} as paid this cycle.
      </div>
      <div style={{ color: "var(--text-3)" }}>
        Auto-match it next cycle? When a transaction contains this text, {expenseName} will show as
        Debited automatically. Trim it to the part that uniquely identifies this payment.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <input
          className="input"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="e.g. LANDLORD NAME"
          disabled={busy}
          style={{ flex: "1 1 220px", fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => onSave(pattern.trim())}
          disabled={busy || pattern.trim().length === 0}
          style={{ fontSize: 11 }}
        >
          Save rule
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onDismiss}
          disabled={busy}
          style={{ fontSize: 11 }}
        >
          Not now
        </button>
      </div>
      {error ? (
        <div style={{ color: "var(--neg)", display: "flex", alignItems: "center", gap: 4 }}>
          <X size={12} /> {error}
        </div>
      ) : null}
    </div>
  );
}
