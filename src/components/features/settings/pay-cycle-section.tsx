"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import clsx from "clsx";

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
import styles from "./settings.module.scss";

const FREQ_OPTIONS = [
  { days: 7, label: "Weekly", hint: "every 7 days", supported: true },
  { days: 14, label: "Bi-weekly", hint: "every 14 days", supported: true },
  { days: 15, label: "Semi-monthly", hint: "1st & 15th", supported: false },
  { days: 30, label: "Monthly", hint: "every 30 days", supported: false },
] as const;

function freqMeta(days: number) {
  if (days === 7) return "WEEKLY · 7 DAYS";
  if (days === 14) return "BIWEEKLY · 14 DAYS";
  return `${days} DAYS`;
}

export function PayCycleSection({ settings }: { settings: SettingsData["settings"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payFrequencyDays, setPayFrequencyDays] = useState<number>(settings.payFrequencyDays ?? 14);
  const [form, setForm] = useState({
    lastPaycheckDate: toDateInput(settings.lastPaycheckDate),
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
        defaultFixedSavings: form.defaultFixedSavings ? Number(form.defaultFixedSavings) : null,
        sweepBuffer: form.sweepBuffer ? Number(form.sweepBuffer) : 100,
        ccPaymentDayOfMonth: form.ccPaymentDayOfMonth ? Number(form.ccPaymentDayOfMonth) : null,
        payFrequencyDays,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="Primary pay frequency" meta={freqMeta(payFrequencyDays)}>
        <div className={styles.payFreqGrid}>
          {FREQ_OPTIONS.map((o) => (
            <button
              key={o.days}
              type="button"
              disabled={!o.supported}
              title={o.supported ? undefined : "Requires cycle-engine work — planned for Phase 2"}
              className={clsx(styles.payFreqCard, payFrequencyDays === o.days && styles.on)}
              onClick={() => o.supported && setPayFrequencyDays(o.days)}
            >
              <div className={styles.payFreqDays}>
                {o.days}
                <span className={styles.u}>d</span>
              </div>
              <div className={styles.payFreqLabel}>{o.label}</div>
              <div className={styles.payFreqHint}>{o.supported ? o.hint : "Phase 2"}</div>
              {payFrequencyDays === o.days ? <span className={styles.payFreqCheck}>●</span> : null}
            </button>
          ))}
        </div>
        <div style={{ ...HINT_STYLE, marginTop: 12 }}>
          Changing frequency regenerates upcoming cycle boundaries and reclassifies transactions on
          save. Closed historical cycles are preserved (a full re-bucket is a later step).
          Semi-monthly and monthly need a different cycle model and are disabled for now.
        </div>
      </Panel>

      <Panel title="Pay cycle">
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
    </>
  );
}
