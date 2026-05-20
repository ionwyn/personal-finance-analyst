"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, IconButton, Panel } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";

import { ErrorLine, INPUT_STYLE, LABEL_STYLE, postJSON } from "./settings-form";

export function SavingsDestinationsSection({
  destinations,
}: {
  destinations: SettingsData["savingsDestinations"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ accountName: "", matchPattern: "", label: "" });

  async function create() {
    if (!draft.accountName.trim() || !draft.matchPattern.trim()) {
      setError("Account name and match pattern are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/savings-destinations", "POST", {
        accountName: draft.accountName.trim(),
        matchPattern: draft.matchPattern.trim(),
        label: draft.label.trim() || null,
      });
      setDraft({ accountName: "", matchPattern: "", label: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create destination.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await postJSON(`/api/settings/savings-destinations/${id}`, "DELETE", null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Savings destinations"
      meta={`${destinations.length} TOTAL · DEBITS TO THESE = SAVINGS`}
    >
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, lineHeight: 1.5 }}>
        Patterns are case-insensitive substring matches against the transaction description (Plaid
        &quot;name&quot;, always present) plus the merchant name (if Plaid set one). e.g.{" "}
        <span className="mono">WEALTHSIMPLE</span> matches &quot;Wealthsimple Transfer 1234&quot;
        and &quot;EFT TO WEALTHSIMPLE&quot;.
      </div>
      {destinations.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>None configured.</div>
      ) : (
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Account</th>
              <th>Match pattern</th>
              <th>Label</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((d) => (
              <tr key={d.id}>
                <td>{d.accountName}</td>
                <td className="mono">{d.matchPattern}</td>
                <td>{d.label ?? "—"}</td>
                <td>
                  <IconButton label="Delete" onClick={() => remove(d.id)}>
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
          gridTemplateColumns: "2fr 2fr 1fr auto",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label style={LABEL_STYLE}>
          Account name
          <input
            type="text"
            value={draft.accountName}
            onChange={(e) => setDraft({ ...draft, accountName: e.target.value })}
            placeholder="Wealthsimple TFSA"
            style={INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Match pattern
          <input
            type="text"
            value={draft.matchPattern}
            onChange={(e) => setDraft({ ...draft, matchPattern: e.target.value })}
            placeholder="WEALTHSIMPLE"
            style={INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Label
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="investing"
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
