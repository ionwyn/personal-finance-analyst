"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Panel } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";
import { LANDING_OPTIONS } from "@/lib/settings/landing";

import { ErrorLine, INPUT_STYLE, postJSON } from "./settings-form";
import styles from "./settings.module.scss";

export function DisplaySection({ settings }: { settings: SettingsData["settings"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landing, setLanding] = useState(settings.defaultLanding ?? "dashboard");

  async function save(next: string) {
    setLanding(next);
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/user-settings", "PATCH", { defaultLanding: next });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preference.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stack}>
      <Panel title="Interface">
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Default landing page</div>
            <div className={styles.rowDesc}>
              The screen you land on after signing in. The Dashboard remains reachable from the
              sidebar regardless.
            </div>
          </div>
          <div className={styles.rowControl}>
            <select
              value={landing}
              disabled={busy}
              onChange={(e) => save(e.target.value)}
              style={{ ...INPUT_STYLE, width: 200, fontFamily: "var(--font-sans)" }}
            >
              {LANDING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ErrorLine error={error} />
          </div>
        </div>
      </Panel>

      <div className={styles.placeholder}>
        <div className={styles.placeholderTag}>Phase 3</div>
        <div className={styles.placeholderTitle}>Theme, currency & formats</div>
        <div className={styles.placeholderText}>
          Light/dark/system theme, display currency (with FX conversion), locale, and date/number
          formats are planned for Phase 3. Currency and formatting require refactoring the hardcoded{" "}
          <code>en-US</code>/<code>USD</code> formatter app-wide.
        </div>
      </div>
    </div>
  );
}
