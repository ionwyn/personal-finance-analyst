"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { SettingsData } from "@/lib/cycles/getSettings";
import { FREQUENCIES } from "@/lib/cycles/types";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  padding: "6px 8px",
  fontSize: 12,
  borderRadius: 4,
  fontFamily: "var(--font-sans)",
  width: "100%",
};

const NUMBER_INPUT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  fontFamily: "var(--font-mono)",
  textAlign: "right",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

const HINT_STYLE: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0,
  textTransform: "none",
  color: "var(--text-4)",
  lineHeight: 1.4,
  fontWeight: 400,
};

type ApiResponse = { error?: string } & Record<string, unknown>;

async function postJSON(url: string, method: string, body: unknown): Promise<ApiResponse> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  let data: ApiResponse = {};
  try {
    data = (await response.json()) as ApiResponse;
  } catch {
    // ignore JSON parse failures on empty bodies
  }
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed with ${response.status}`);
  }
  return data;
}

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function SettingsView({ data }: { data: SettingsData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PayCycleSection settings={data.settings} />
      <RecurringExpensesSection expenses={data.recurringExpenses} />
      <SavingsDestinationsSection destinations={data.savingsDestinations} />
      <SettlementPatternsSection patterns={data.settlementPatterns} />
    </div>
  );
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {meta ? <div className="panel-meta">{meta}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <span className="inline-error">{error}</span>;
}

/* ---------- Pay cycle ---------- */

function PayCycleSection({ settings }: { settings: SettingsData["settings"] }) {
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
        <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <ErrorLine error={error} />
      </div>
    </Panel>
  );
}

/* ---------- Recurring expenses ---------- */

function RecurringExpensesSection({ expenses }: { expenses: SettingsData["recurringExpenses"] }) {
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
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => toggleActive(e.id, e.active)}
                  >
                    {e.active ? "Active" : "Paused"}
                  </button>
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => remove(e.id)}
                    aria-label="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
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
        <button className="btn btn-primary btn-sm" type="button" onClick={create} disabled={busy}>
          Add
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <ErrorLine error={error} />
      </div>
    </Panel>
  );
}

/* ---------- Savings destinations ---------- */

function SavingsDestinationsSection({
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
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => remove(d.id)}
                    aria-label="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
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
        <button className="btn btn-primary btn-sm" type="button" onClick={create} disabled={busy}>
          Add
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <ErrorLine error={error} />
      </div>
    </Panel>
  );
}

/* ---------- Settlement patterns ---------- */

function SettlementPatternsSection({ patterns }: { patterns: SettingsData["settlementPatterns"] }) {
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
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
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
        <button className="btn btn-primary btn-sm" type="button" onClick={create} disabled={busy}>
          Add
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <ErrorLine error={error} />
      </div>
    </Panel>
  );
}
