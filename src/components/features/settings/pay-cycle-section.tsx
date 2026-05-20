"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Panel } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";

import {
  ErrorLine,
  HINT_STYLE,
  INPUT_STYLE,
  LABEL_STYLE,
  NUMBER_INPUT_STYLE,
  postJSON,
  toDateInput,
} from "./settings-form";

export function PayCycleSection({ settings }: { settings: SettingsData["settings"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    lastPaycheckDate: toDateInput(settings.lastPaycheckDate),
    employerMerchantPattern: settings.employerMerchantPattern ?? "",
    defaultFixedSavings:
      settings.defaultFixedSavings != null ? String(settings.defaultFixedSavings) : "",
    sweepBuffer: String(settings.sweepBuffer ?? 100),
    ccPaymentDayOfMonth:
      settings.ccPaymentDayOfMonth != null ? String(settings.ccPaymentDayOfMonth) : "",
  });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/user-settings", "PATCH", {
        lastPaycheckDate: form.lastPaycheckDate || null,
        employerMerchantPattern: form.employerMerchantPattern.trim() || null,
        defaultFixedSavings: form.defaultFixedSavings ? Number(form.defaultFixedSavings) : null,
        sweepBuffer: form.sweepBuffer ? Number(form.sweepBuffer) : 100,
        ccPaymentDayOfMonth: form.ccPaymentDayOfMonth ? Number(form.ccPaymentDayOfMonth) : null,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Pay cycle" meta="BIWEEKLY · 14 DAYS">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          maxWidth: 720,
        }}
      >
        <label style={LABEL_STYLE}>
          Last paycheck date
          <input
            type="date"
            value={form.lastPaycheckDate}
            onChange={(e) => setForm({ ...form, lastPaycheckDate: e.target.value })}
            style={{ ...INPUT_STYLE, fontFamily: "var(--font-mono)" }}
          />
        </label>
        <label style={LABEL_STYLE}>
          Employer merchant pattern
          <input
            type="text"
            value={form.employerMerchantPattern}
            onChange={(e) => setForm({ ...form, employerMerchantPattern: e.target.value })}
            placeholder="e.g. ACME PAYROLL"
            style={INPUT_STYLE}
          />
          <span style={HINT_STYLE}>
            Case-insensitive substring match against the transaction description (Plaid
            &quot;name&quot;, always present) plus the merchant name (if Plaid set one). e.g. ACME
            PAYROLL matches &quot;ACME PAYROLL DIRECT DEP&quot;.
          </span>
        </label>
        <label style={LABEL_STYLE}>
          Default fixed savings (Stage 1)
          <input
            type="number"
            step="50"
            value={form.defaultFixedSavings}
            onChange={(e) => setForm({ ...form, defaultFixedSavings: e.target.value })}
            placeholder="e.g. 600"
            style={NUMBER_INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Sweep buffer
          <input
            type="number"
            step="50"
            value={form.sweepBuffer}
            onChange={(e) => setForm({ ...form, sweepBuffer: e.target.value })}
            style={NUMBER_INPUT_STYLE}
          />
        </label>
        <label style={LABEL_STYLE}>
          Credit card payment day of month
          <input
            type="number"
            min={1}
            max={31}
            value={form.ccPaymentDayOfMonth}
            onChange={(e) => setForm({ ...form, ccPaymentDayOfMonth: e.target.value })}
            placeholder="e.g. 31"
            style={NUMBER_INPUT_STYLE}
          />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        <Button variant="primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <ErrorLine error={error} />
      </div>
    </Panel>
  );
}
