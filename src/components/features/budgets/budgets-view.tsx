"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button, DateRangePicker, IconButton, PageHeader, Panel } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import type { BudgetGoalData, BudgetProgress, GoalProgress } from "@/lib/budgets/getBudgetGoalData";

import styles from "./budgets.module.scss";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

type GoalDraft = {
  id: string | null;
  name: string;
  target: string;
  from: string;
  to: string;
  destinationId: string;
};

const emptyGoal: GoalDraft = {
  id: null,
  name: "",
  target: "",
  from: "",
  to: "",
  destinationId: "",
};

function CapRow({
  b,
  warnPct,
  busy,
  onSave,
  onRemove,
}: {
  b: BudgetProgress;
  warnPct: number;
  busy: boolean;
  onSave: (amount: number) => void;
  onRemove: () => void;
}) {
  const fillPct = Math.min(b.pct, 100);
  const overPct = Math.min(Math.max(b.pct - 100, 0), 30);
  const fillColor =
    b.status === "over" ? "var(--neg)" : b.status === "warn" ? "var(--warn)" : b.color;

  return (
    <div className={styles.capRow}>
      <div className={styles.capRowHead}>
        <span className={styles.swLg} style={{ background: b.color }} />
        <span className={styles.capName}>{b.categoryLabel}</span>
        <span className={styles.capSpent}>
          {formatCurrency(b.spent)}
          <span className={styles.of}>/ {formatCurrency(b.cap)}</span>
        </span>
        <div className={styles.capControls}>
          <input
            type="number"
            min={0}
            step={25}
            defaultValue={b.cap}
            disabled={busy}
            aria-label={`${b.categoryLabel} monthly cap`}
            className={styles.capInput}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0 && v !== b.cap) onSave(v);
            }}
          />
          {b.status === "over" ? (
            <span className={`${styles.badge} ${styles.badgeOver}`}>Over</span>
          ) : null}
          {b.status === "warn" ? (
            <span className={`${styles.badge} ${styles.badgeWarn}`}>Warn</span>
          ) : null}
          <IconButton label="Remove budget" onClick={onRemove}>
            <Trash2 size={11} />
          </IconButton>
        </div>
      </div>
      <div className={styles.capBar}>
        <div
          className={styles.capBarFill}
          style={{ width: `${fillPct}%`, background: fillColor }}
        />
        {overPct > 0 ? (
          <div className={styles.capBarOver} style={{ width: `${overPct}%` }} />
        ) : null}
        {warnPct > 0 && warnPct < 100 ? (
          <div
            className={styles.capBarMark}
            style={{ left: `${warnPct}%` }}
            title={`warn ${warnPct}%`}
          />
        ) : null}
      </div>
    </div>
  );
}

function GoalCard({
  g,
  onEdit,
  onRemove,
}: {
  g: GoalProgress;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const range =
    g.startDate || g.targetDate
      ? `${g.startDate ? g.startDate.slice(0, 10) : "—"} → ${g.targetDate ? g.targetDate.slice(0, 10) : "—"}`
      : "No timeframe";
  return (
    <div className={styles.goalCard}>
      <div className={styles.goalHead}>
        <div>
          <div className={styles.goalName}>{g.name}</div>
          <div className={styles.goalDest}>{g.destinationLabel ?? "manual — not auto-tracked"}</div>
        </div>
        <div className={styles.goalActions}>
          <IconButton label="Edit goal" onClick={onEdit}>
            <Pencil size={11} />
          </IconButton>
          <IconButton label="Delete goal" onClick={onRemove}>
            <Trash2 size={11} />
          </IconButton>
        </div>
      </div>
      <div className={styles.goalAmts}>
        <span className={styles.goalCurrent}>{formatCurrency(g.saved)}</span>
        <span className={styles.goalTarget}>/ {formatCurrency(g.target)}</span>
        <span className={styles.goalPct}>{Math.round(g.pct)}%</span>
      </div>
      <div className={styles.goalBar}>
        <div
          className={styles.goalBarFill}
          style={{ width: `${g.pct}%`, background: g.reached ? "var(--pos)" : g.color }}
        />
      </div>
      <div className={styles.goalFoot}>
        <span className={styles.goalCond}>Timeframe</span>
        <span className={styles.goalEta}>{range}</span>
      </div>
    </div>
  );
}

export function BudgetsView({ data }: { data: BudgetGoalData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCat, setNewCat] = useState("");
  const [newCap, setNewCap] = useState("");
  const [goal, setGoal] = useState<GoalDraft | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function addBudget() {
    if (!newCat || !newCap) {
      setError("Pick a category and a monthly cap.");
      return;
    }
    void run(async () => {
      await api("/api/settings/budgets", "POST", {
        categoryPrimary: newCat,
        amount: Number(newCap),
      });
      setNewCat("");
      setNewCap("");
    });
  }

  function saveGoal() {
    if (!goal) return;
    if (!goal.name.trim() || !goal.target) {
      setError("A goal needs a name and a target amount.");
      return;
    }
    const payload = {
      name: goal.name.trim(),
      targetAmount: Number(goal.target),
      startDate: goal.from || null,
      targetDate: goal.to || null,
      savingsDestinationId: goal.destinationId || null,
    };
    void run(async () => {
      if (goal.id) {
        await api(`/api/settings/savings-goals/${goal.id}`, "PATCH", payload);
      } else {
        await api("/api/settings/savings-goals", "POST", payload);
      }
      setGoal(null);
    });
  }

  return (
    <div>
      <PageHeader
        title="Budgets & Goals"
        subtitle={`Category caps for ${data.monthLabel} · savings targets`}
        actions={
          <Link href="/app/settings?s=budgets" className="btn btn-sm">
            Alert thresholds
          </Link>
        }
      />

      <div className={styles.grid2}>
        <Panel
          title="Category caps"
          meta={`${data.budgets.length} BUDGETED · PER MONTH`}
          bodyStyle={{ padding: 0 }}
        >
          {data.budgets.length === 0 ? (
            <div className={styles.empty}>No category caps yet — add one below.</div>
          ) : (
            <div className={styles.capsList}>
              {data.budgets.map((b) => (
                <CapRow
                  key={b.id}
                  b={b}
                  warnPct={data.warnPct}
                  busy={busy}
                  onSave={(amount) => {
                    void run(() => api(`/api/settings/budgets/${b.id}`, "PATCH", { amount }));
                  }}
                  onRemove={() => {
                    void run(() => api(`/api/settings/budgets/${b.id}`, "DELETE"));
                  }}
                />
              ))}
            </div>
          )}
          <div className={styles.addRow}>
            <label className={styles.field}>
              Category
              <select
                className={styles.select}
                value={newCat}
                disabled={busy || data.availableCategories.length === 0}
                onChange={(e) => setNewCat(e.target.value)}
              >
                <option value="">
                  {data.availableCategories.length
                    ? "Select a category…"
                    : "All categories budgeted"}
                </option>
                {data.availableCategories.map((c) => (
                  <option key={c.raw} value={c.raw}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Monthly cap
              <input
                type="number"
                min={0}
                step={25}
                className={`${styles.input} ${styles.inputNum}`}
                style={{ width: 110 }}
                placeholder="500"
                value={newCap}
                onChange={(e) => setNewCap(e.target.value)}
              />
            </label>
            <Button
              variant="primary"
              size="sm"
              onClick={addBudget}
              disabled={busy}
              icon={<Plus size={11} />}
            >
              Add cap
            </Button>
          </div>
        </Panel>

        <Panel
          title="Savings goals"
          meta={`${data.goals.length} ACTIVE`}
          actions={
            <Button
              size="sm"
              onClick={() => setGoal(goal ? null : { ...emptyGoal })}
              icon={goal ? <X size={11} /> : <Plus size={11} />}
            >
              {goal ? "Close" : "New goal"}
            </Button>
          }
          bodyStyle={{ padding: 0 }}
        >
          {data.goals.length === 0 ? (
            <div className={styles.empty}>
              No savings goals yet. Link one to a savings destination to track progress
              automatically.
            </div>
          ) : (
            <div className={styles.goalsGrid}>
              {data.goals.map((g) => (
                <GoalCard
                  key={g.id}
                  g={g}
                  onEdit={() =>
                    setGoal({
                      id: g.id,
                      name: g.name,
                      target: String(g.target),
                      from: g.startDate ? g.startDate.slice(0, 10) : "",
                      to: g.targetDate ? g.targetDate.slice(0, 10) : "",
                      destinationId: g.savingsDestinationId ?? "",
                    })
                  }
                  onRemove={() => {
                    void run(() => api(`/api/settings/savings-goals/${g.id}`, "DELETE"));
                  }}
                />
              ))}
            </div>
          )}

          {goal ? (
            <div className={styles.goalForm}>
              <div className={styles.goalFormRow}>
                <label className={styles.field} style={{ flex: "2 1 200px" }}>
                  Name
                  <input
                    className={styles.input}
                    value={goal.name}
                    placeholder="Emergency fund"
                    onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                  />
                </label>
                <label className={styles.field} style={{ flex: "1 1 120px" }}>
                  Target
                  <input
                    type="number"
                    min={0}
                    step={100}
                    className={`${styles.input} ${styles.inputNum}`}
                    value={goal.target}
                    placeholder="10000"
                    onChange={(e) => setGoal({ ...goal, target: e.target.value })}
                  />
                </label>
              </div>
              <div className={styles.goalFormRow}>
                <label className={styles.field}>
                  Start → target date
                  <DateRangePicker
                    from={goal.from}
                    to={goal.to}
                    onChange={(from, to) => setGoal({ ...goal, from, to })}
                  />
                </label>
                <label className={styles.field} style={{ flex: "1 1 180px" }}>
                  Tracks destination
                  <select
                    className={styles.select}
                    value={goal.destinationId}
                    onChange={(e) => setGoal({ ...goal, destinationId: e.target.value })}
                  >
                    <option value="">Manual (no auto-tracking)</option>
                    {data.destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.formActions}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveGoal}
                  disabled={busy}
                  icon={<Check size={11} />}
                >
                  {goal.id ? "Save goal" : "Add goal"}
                </Button>
                <Button size="sm" onClick={() => setGoal(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      {error ? (
        <div style={{ marginTop: 12 }}>
          <span className="inline-error">{error}</span>
        </div>
      ) : null}
    </div>
  );
}
