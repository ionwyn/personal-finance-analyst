"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, IconButton, Panel } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";

import { ErrorLine, INPUT_STYLE, LABEL_STYLE, postJSON } from "./settings-form";
import styles from "./settings.module.scss";

export function IncomeSourcesSection({ sources }: { sources: SettingsData["incomeSources"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ label: "", matchPattern: "" });

  async function create() {
    if (!draft.label.trim() || !draft.matchPattern.trim()) {
      setError("Label and match pattern are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/income-sources", "POST", {
        label: draft.label.trim(),
        matchPattern: draft.matchPattern.trim(),
      });
      setDraft({ label: "", matchPattern: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add income source.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await postJSON(`/api/settings/income-sources/${id}`, "DELETE", null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Income sources"
      meta={`${sources.length} TOTAL · CREDITS MATCHING THESE = INCOME`}
    >
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, lineHeight: 1.5 }}>
        Each pattern is a case-insensitive substring match against the transaction description
        (Plaid &quot;name&quot;) plus merchant name. Matching deposits are classified as income and
        roll into pay-cycle income and the Spending Insight income total — so multiple paychecks or
        side incomes are all counted. Plaid&apos;s own salary detection still applies as a fallback.
      </div>
      {sources.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          None configured — only Plaid-detected salary will count as income.
        </div>
      ) : (
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Label</th>
              <th>Match pattern</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} style={s.active ? undefined : { opacity: 0.5 }}>
                <td>{s.label}</td>
                <td className="mono">{s.matchPattern}</td>
                <td>
                  <IconButton label="Delete" onClick={() => remove(s.id)}>
                    <Trash2 size={11} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={`${styles.addRow} ${styles.addRowIncome}`}>
        <label style={LABEL_STYLE}>
          Label
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Primary employer"
            style={INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Match pattern
          <input
            type="text"
            value={draft.matchPattern}
            onChange={(e) => setDraft({ ...draft, matchPattern: e.target.value })}
            placeholder="ACME PAYROLL"
            style={INPUT_STYLE}
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
