"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, IconButton, Panel } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import type { SettingsData } from "@/lib/cycles/getSettings";

import { ErrorLine, INPUT_STYLE, LABEL_STYLE, NUMBER_INPUT_STYLE, postJSON } from "./settings-form";

type Props = {
  budgets: SettingsData["budgets"];
  goals: SettingsData["savingsGoals"];
  spendingCategories: SettingsData["spendingCategories"];
  destinations: SettingsData["savingsDestinations"];
};

export function BudgetsGoalsSection({ budgets, goals, spendingCategories, destinations }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budgetedCategories = useMemo(
    () => new Set(budgets.map((b) => b.categoryPrimary)),
    [budgets]
  );
  const availableCategories = spendingCategories.filter((c) => !budgetedCategories.has(c.raw));

  const [budgetDraft, setBudgetDraft] = useState({ categoryPrimary: "", amount: "" });
  const [goalDraft, setGoalDraft] = useState({
    name: "",
    targetAmount: "",
    targetDate: "",
    savingsDestinationId: "",
  });

  async function addBudget() {
    if (!budgetDraft.categoryPrimary || !budgetDraft.amount) {
      setError("Pick a category and a monthly cap.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/budgets", "POST", {
        categoryPrimary: budgetDraft.categoryPrimary,
        amount: Number(budgetDraft.amount),
      });
      setBudgetDraft({ categoryPrimary: "", amount: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add budget.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBudget(id: string) {
    setBusy(true);
    try {
      await postJSON(`/api/settings/budgets/${id}`, "DELETE", null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete budget.");
    } finally {
      setBusy(false);
    }
  }

  async function addGoal() {
    if (!goalDraft.name.trim() || !goalDraft.targetAmount) {
      setError("A goal needs a name and a target amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/savings-goals", "POST", {
        name: goalDraft.name.trim(),
        targetAmount: Number(goalDraft.targetAmount),
        targetDate: goalDraft.targetDate || null,
        savingsDestinationId: goalDraft.savingsDestinationId || null,
      });
      setGoalDraft({ name: "", targetAmount: "", targetDate: "", savingsDestinationId: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add goal.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal(id: string) {
    setBusy(true);
    try {
      await postJSON(`/api/settings/savings-goals/${id}`, "DELETE", null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete goal.");
    } finally {
      setBusy(false);
    }
  }

  const activeDestinations = destinations.filter((d) => d.active);

  return (
    <>
      <Panel title="Category budgets" meta={`${budgets.length} SET · MONTHLY CAPS`}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, lineHeight: 1.5 }}>
          Set a monthly spending cap for any Plaid category you spend in. Caps reset on the 1st and
          compare against month-to-date spend. Progress and overspend flags show on the Budgets
          &amp; Goals page.
        </div>
        {budgets.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>No budgets set.</div>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Monthly cap</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} style={b.active ? undefined : { opacity: 0.5 }}>
                  <td>{b.categoryLabel}</td>
                  <td className="num mono">{formatCurrency(b.amount)}</td>
                  <td>
                    <IconButton label="Delete" onClick={() => removeBudget(b.id)}>
                      <Trash2 size={11} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--border-strong)",
            display: "grid",
            gridTemplateColumns: "2fr 1fr auto",
            gap: 8,
            alignItems: "end",
          }}
        >
          <label style={LABEL_STYLE}>
            Category
            <select
              value={budgetDraft.categoryPrimary}
              onChange={(e) => setBudgetDraft({ ...budgetDraft, categoryPrimary: e.target.value })}
              style={{ ...INPUT_STYLE, fontFamily: "var(--font-sans)" }}
            >
              <option value="">
                {availableCategories.length ? "Select a category…" : "All categories budgeted"}
              </option>
              {availableCategories.map((c) => (
                <option key={c.raw} value={c.raw}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label style={LABEL_STYLE}>
            Monthly cap
            <input
              type="number"
              step="50"
              min="0"
              value={budgetDraft.amount}
              onChange={(e) => setBudgetDraft({ ...budgetDraft, amount: e.target.value })}
              placeholder="500"
              style={NUMBER_INPUT_STYLE}
            />
          </label>
          <Button variant="primary" size="sm" onClick={addBudget} disabled={busy}>
            Add
          </Button>
        </div>
      </Panel>

      <Panel title="Savings goals" meta={`${goals.length} TOTAL`}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, lineHeight: 1.5 }}>
          Track progress toward a savings target. Link a goal to a savings destination and progress
          is computed automatically from transactions routed there.
        </div>
        {goals.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>No goals yet.</div>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Goal</th>
                <th className="num">Target</th>
                <th>By</th>
                <th>Tracks</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id} style={g.active ? undefined : { opacity: 0.5 }}>
                  <td>{g.name}</td>
                  <td className="num mono">{formatCurrency(g.targetAmount)}</td>
                  <td className="mono">{g.targetDate ? g.targetDate.slice(0, 10) : "—"}</td>
                  <td>
                    {g.destinationLabel ?? <span style={{ color: "var(--text-4)" }}>manual</span>}
                  </td>
                  <td>
                    <IconButton label="Delete" onClick={() => removeGoal(g.id)}>
                      <Trash2 size={11} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--border-strong)",
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1.5fr auto",
            gap: 8,
            alignItems: "end",
          }}
        >
          <label style={LABEL_STYLE}>
            Name
            <input
              type="text"
              value={goalDraft.name}
              onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })}
              placeholder="Emergency fund"
              style={INPUT_STYLE}
            />
          </label>
          <label style={LABEL_STYLE}>
            Target
            <input
              type="number"
              step="100"
              min="0"
              value={goalDraft.targetAmount}
              onChange={(e) => setGoalDraft({ ...goalDraft, targetAmount: e.target.value })}
              placeholder="10000"
              style={NUMBER_INPUT_STYLE}
            />
          </label>
          <label style={LABEL_STYLE}>
            Target date
            <input
              type="date"
              value={goalDraft.targetDate}
              onChange={(e) => setGoalDraft({ ...goalDraft, targetDate: e.target.value })}
              style={{ ...INPUT_STYLE, fontFamily: "var(--font-mono)" }}
            />
          </label>
          <label style={LABEL_STYLE}>
            Tracks destination
            <select
              value={goalDraft.savingsDestinationId}
              onChange={(e) => setGoalDraft({ ...goalDraft, savingsDestinationId: e.target.value })}
              style={{ ...INPUT_STYLE, fontFamily: "var(--font-sans)" }}
            >
              <option value="">Manual (no auto-tracking)</option>
              {activeDestinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label ?? d.accountName}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" size="sm" onClick={addGoal} disabled={busy}>
            Add
          </Button>
        </div>
      </Panel>

      <div style={{ marginTop: 4 }}>
        <ErrorLine error={error} />
      </div>
    </>
  );
}
