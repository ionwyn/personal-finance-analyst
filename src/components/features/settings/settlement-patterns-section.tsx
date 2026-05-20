"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, IconButton, Panel } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";

import { ErrorLine, INPUT_STYLE, LABEL_STYLE, postJSON } from "./settings-form";

export function SettlementPatternsSection({
  patterns,
}: {
  patterns: SettingsData["settlementPatterns"];
}) {
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
      await postJSON("/api/settings/settlement-patterns", "POST", {
        label: draft.label.trim(),
        matchPattern: draft.matchPattern.trim(),
      });
      setDraft({ label: "", matchPattern: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create pattern.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await postJSON(`/api/settings/settlement-patterns/${id}`, "DELETE", null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Settlement patterns" meta={`${patterns.length} TOTAL · EXCLUDED FROM BUDGET`}>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, lineHeight: 1.5 }}>
        Patterns are case-insensitive substring matches against the transaction description (Plaid
        &quot;name&quot;, always present) plus the merchant name (if Plaid set one). e.g.{" "}
        <span className="mono">AMEX PAYMENT</span> matches &quot;AMEX EPAYMENT THANK YOU&quot;.
      </div>
      {patterns.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>None configured.</div>
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
            {patterns.map((p) => (
              <tr key={p.id}>
                <td>{p.label}</td>
                <td className="mono">{p.matchPattern}</td>
                <td>
                  <IconButton label="Delete" onClick={() => remove(p.id)}>
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
          gridTemplateColumns: "1fr 2fr auto",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label style={LABEL_STYLE}>
          Label
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Amex payment"
            style={INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Match pattern
          <input
            type="text"
            value={draft.matchPattern}
            onChange={(e) => setDraft({ ...draft, matchPattern: e.target.value })}
            placeholder="AMEX PAYMENT"
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
