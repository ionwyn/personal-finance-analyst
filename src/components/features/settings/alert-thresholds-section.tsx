"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Panel, Switch } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";

import { ErrorLine, NUMBER_INPUT_STYLE, postJSON } from "./settings-form";
import styles from "./settings.module.scss";

export function AlertThresholdsSection({ settings }: { settings: SettingsData["settings"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState(String(settings.budgetWarnPct ?? 85));
  const [alarm, setAlarm] = useState(String(settings.budgetAlarmPct ?? 100));
  const [rollForward, setRollForward] = useState(Boolean(settings.budgetRollForward));

  async function save(patch: Record<string, unknown>) {
    setError(null);
    try {
      await postJSON("/api/settings/user-settings", "PATCH", patch);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    }
  }

  function saveWarn() {
    const v = Number(warn);
    if (Number.isFinite(v)) void save({ budgetWarnPct: Math.round(v) });
  }
  function saveAlarm() {
    const v = Number(alarm);
    if (Number.isFinite(v)) void save({ budgetAlarmPct: Math.round(v) });
  }

  return (
    <Panel title="Alert thresholds" meta="WHEN TO NUDGE">
      <div className={styles.row}>
        <div className={styles.rowLabel}>
          <div className={styles.rowTitle}>Warn</div>
          <div className={styles.rowDesc}>
            A yellow flag appears on a category once this % of its monthly cap is spent.
          </div>
        </div>
        <div className={styles.rowControl}>
          <input
            type="number"
            min={0}
            max={200}
            value={warn}
            onChange={(e) => setWarn(e.target.value)}
            onBlur={saveWarn}
            style={{ ...NUMBER_INPUT_STYLE, width: 92 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>%</span>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowLabel}>
          <div className={styles.rowTitle}>Alarm</div>
          <div className={styles.rowDesc}>
            A category turns red (over budget) once this % of its cap is reached.
          </div>
        </div>
        <div className={styles.rowControl}>
          <input
            type="number"
            min={0}
            max={200}
            value={alarm}
            onChange={(e) => setAlarm(e.target.value)}
            onBlur={saveAlarm}
            style={{ ...NUMBER_INPUT_STYLE, width: 92 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>%</span>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.rowLabel}>
          <div className={styles.rowTitle}>Roll unused budget forward</div>
          <div className={styles.rowDesc}>
            Preference for carrying a category&apos;s remaining cap into the next month. Stored now;
            applied when month-rollover carry ships.
          </div>
        </div>
        <div className={styles.rowControl}>
          <Switch
            isSelected={rollForward}
            onChange={(next) => {
              setRollForward(next);
              void save({ budgetRollForward: next });
            }}
          >
            {rollForward ? "On" : "Off"}
          </Switch>
        </div>
      </div>

      <div style={{ padding: "8px 16px" }}>
        <ErrorLine error={error} />
      </div>
    </Panel>
  );
}
