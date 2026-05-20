"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, IconButton, Panel } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";
import { FREQUENCIES } from "@/lib/cycles/types";

import { ErrorLine, INPUT_STYLE, LABEL_STYLE, NUMBER_INPUT_STYLE, postJSON } from "./settings-form";

export function RecurringExpensesSection({
  expenses,
}: {
  expenses: SettingsData["recurringExpenses"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    merchantPattern: "",
    amount: "",
    frequency: "monthly" as (typeof FREQUENCIES)[number],
    anchorDate: "",
  });

  async function create() {
    if (!draft.name.trim() || !draft.amount) {
      setError("Name and amount are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/recurring-expenses", "POST", {
        name: draft.name.trim(),
        merchantPattern: draft.merchantPattern.trim() || null,
        amount: Number(draft.amount),
        frequency: draft.frequency,
        anchorDate: draft.anchorDate ? Number(draft.anchorDate) : null,
        confirmed: true,
      });
      setDraft({ name: "", merchantPattern: "", amount: "", frequency: "monthly", anchorDate: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create recurring expense.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this recurring expense?")) return;
    setBusy(true);
    try {
      await postJSON(`/api/settings/recurring-expenses/${id}`, "DELETE", null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete recurring expense.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(true);
    try {
      await postJSON(`/api/settings/recurring-expenses/${id}`, "PATCH", { active: !active });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Recurring expenses" meta={`${expenses.length} TOTAL · CONFIRMED`}>
      {expenses.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          None yet. Add committed expenses below; they accrue across cycles.
        </div>
      ) : (
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Pattern</th>
              <th>Frequency</th>
              <th className="num">Amount</th>
              <th className="num">Accrual / cycle</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} style={{ opacity: e.active ? 1 : 0.5 }}>
                <td>{e.name}</td>
                <td className="mono">{e.merchantPattern ?? "—"}</td>
                <td>{e.frequency}</td>
                <td className="num mono">${e.amount.toFixed(2)}</td>
                <td className="num mono">${e.accrualPerCycle.toFixed(2)}</td>
                <td>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(e.id, e.active)}>
                    {e.active ? "Active" : "Paused"}
                  </Button>
                </td>
                <td>
                  <IconButton label="Delete" onClick={() => remove(e.id)}>
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
          gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 60px auto",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label style={LABEL_STYLE}>
          Name
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Rent"
            style={INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Pattern
          <input
            type="text"
            value={draft.merchantPattern}
            onChange={(e) => setDraft({ ...draft, merchantPattern: e.target.value })}
            placeholder="LANDLORD"
            style={INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Amount
          <input
            type="number"
            step="0.01"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            style={NUMBER_INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Frequency
          <select
            value={draft.frequency}
            onChange={(e) =>
              setDraft({ ...draft, frequency: e.target.value as (typeof FREQUENCIES)[number] })
            }
            style={INPUT_STYLE}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label style={LABEL_STYLE}>
          Anchor day
          <input
            type="number"
            min={1}
            max={31}
            value={draft.anchorDate}
            onChange={(e) => setDraft({ ...draft, anchorDate: e.target.value })}
            placeholder="—"
            style={NUMBER_INPUT_STYLE}
          />
        </label>
        <Button variant="primary" size="sm" onClick={create} disabled={busy}>
          Add
        </Button>
      </div>
      <div style={{ marginTop: 8 }}>
        <ErrorLine error={error} />
      </div>
    </Panel>
  );
}
