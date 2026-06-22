"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, IconButton, Panel } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";
import { FREQUENCIES } from "@/lib/cycles/types";

import { ErrorLine, INPUT_STYLE, LABEL_STYLE, NUMBER_INPUT_STYLE, postJSON } from "./settings-form";
import styles from "./settings.module.scss";

type EditState = { anchorDate: string; merchantPattern: string };

const CELL_INPUT: React.CSSProperties = {
  background: "transparent",
  border: "1px solid transparent",
  color: "var(--text)",
  padding: "2px 4px",
  fontSize: 12,
  borderRadius: 3,
  fontFamily: "var(--font-mono)",
  width: "100%",
  minWidth: 0,
};

const CELL_INPUT_FOCUS: React.CSSProperties = {
  ...CELL_INPUT,
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

export function RecurringExpensesSection({
  expenses,
}: {
  expenses: SettingsData["recurringExpenses"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<EditState>>>({});
  const edits: Record<string, EditState> = Object.fromEntries(
    expenses.map((e) => [
      e.id,
      {
        anchorDate:
          localEdits[e.id]?.anchorDate ?? (e.anchorDate != null ? String(e.anchorDate) : ""),
        merchantPattern: localEdits[e.id]?.merchantPattern ?? e.merchantPattern ?? "",
      },
    ])
  );
  const [focusedCell, setFocusedCell] = useState<string | null>(null);

  async function saveEdit(id: string, field: keyof EditState) {
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;
    const value = edits[id]?.[field] ?? "";
    const original =
      field === "anchorDate"
        ? expense.anchorDate != null
          ? String(expense.anchorDate)
          : ""
        : (expense.merchantPattern ?? "");
    if (value === original) return;
    try {
      await postJSON(`/api/settings/recurring-expenses/${id}`, "PATCH", {
        [field]: field === "anchorDate" ? (value ? Number(value) : null) : value.trim() || null,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    }
  }

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
              <th title="Merchant name fragment used to auto-match transactions">Pattern</th>
              <th
                className="num"
                style={{ width: 72 }}
                title="Day of month the charge lands (1–31). Enables 'upcoming' status."
              >
                Anchor
              </th>
              <th>Frequency</th>
              <th className="num">Amount</th>
              <th className="num">Accrual / cycle</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => {
              const cellKey = (field: string) => `${e.id}:${field}`;
              return (
                <tr key={e.id} style={{ opacity: e.active ? 1 : 0.5 }}>
                  <td>{e.name}</td>
                  <td style={{ minWidth: 100 }}>
                    <input
                      style={focusedCell === cellKey("pattern") ? CELL_INPUT_FOCUS : CELL_INPUT}
                      value={edits[e.id]?.merchantPattern ?? ""}
                      placeholder="—"
                      onFocus={() => setFocusedCell(cellKey("pattern"))}
                      onChange={(ev) =>
                        setLocalEdits((prev) => ({
                          ...prev,
                          [e.id]: { ...prev[e.id], merchantPattern: ev.target.value },
                        }))
                      }
                      onBlur={() => {
                        setFocusedCell(null);
                        saveEdit(e.id, "merchantPattern");
                      }}
                    />
                  </td>
                  <td className="num" style={{ width: 72 }}>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      style={
                        focusedCell === cellKey("anchor")
                          ? { ...CELL_INPUT_FOCUS, textAlign: "right" }
                          : { ...CELL_INPUT, textAlign: "right" }
                      }
                      value={edits[e.id]?.anchorDate ?? ""}
                      placeholder="—"
                      onFocus={() => setFocusedCell(cellKey("anchor"))}
                      onChange={(ev) =>
                        setLocalEdits((prev) => ({
                          ...prev,
                          [e.id]: { ...prev[e.id], anchorDate: ev.target.value },
                        }))
                      }
                      onBlur={() => {
                        setFocusedCell(null);
                        saveEdit(e.id, "anchorDate");
                      }}
                    />
                  </td>
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
              );
            })}
          </tbody>
        </table>
      )}

      <div className={`${styles.addRow} ${styles.addRowRecurring}`}>
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
