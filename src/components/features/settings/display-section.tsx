"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Panel, SegmentedControl, Switch } from "@/components/ui";
import type { SettingsData } from "@/lib/cycles/getSettings";
import { LANDING_OPTIONS } from "@/lib/settings/landing";
import { useMounted } from "@/lib/use-mounted";

import { ErrorLine, INPUT_STYLE, postJSON } from "./settings-form";
import styles from "./settings.module.scss";

/*
 * Phase 3 — Display & Preferences (UI scaffold).
 *
 * This renders the full Display & Preferences surface from the design. Wired:
 *   - Default landing page → persists to UserSettings (Phase 1).
 *   - Theme (dark/light/system) → next-themes (localStorage + <html data-theme>),
 *     with the light palette defined in the design tokens.
 *
 * The remaining controls hold local state and are intentionally NOT persisted or
 * applied yet — they're prepared seams for follow-up feature work:
 *   - currency / locale / date / number format → refactor `lib/format.ts` off
 *     hardcoded en-US/USD + persist on UserSettings.
 *   - row density / tabular numbers → global CSS preference classes.
 *   - market session pill → topbar feature + toggle persistence.
 */

const SELECT_STYLE = { ...INPUT_STYLE, width: 200, fontFamily: "var(--font-sans)" } as const;

const CURRENCY_OPTIONS = [
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound Sterling" },
  { value: "JPY", label: "JPY — Japanese Yen" },
];

const LOCALE_OPTIONS = [
  { value: "en-CA", label: "English (Canada)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "fr-CA", label: "Français (Canada)" },
  { value: "de-DE", label: "Deutsch (Deutschland)" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "iso", label: "2026-04-28", ariaLabel: "ISO 8601" },
  { value: "med", label: "Apr 28, 2026", ariaLabel: "Medium" },
  { value: "euro", label: "28/04/2026", ariaLabel: "Day first" },
  { value: "us", label: "04/28/2026", ariaLabel: "Month first" },
] as const;

const NUMBER_FORMAT_OPTIONS = [
  { value: "us", label: "1,234.56", ariaLabel: "Comma thousands, dot decimal" },
  { value: "eu", label: "1.234,56", ariaLabel: "Dot thousands, comma decimal" },
  { value: "fr", label: "1 234,56", ariaLabel: "Space thousands, comma decimal" },
] as const;

const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "cozy", label: "Cozy" },
  { value: "comfortable", label: "Comfortable" },
] as const;

type DateFmt = (typeof DATE_FORMAT_OPTIONS)[number]["value"];
type NumFmt = (typeof NUMBER_FORMAT_OPTIONS)[number]["value"];
type Density = (typeof DENSITY_OPTIONS)[number]["value"];

const THEMES = [
  {
    value: "dark",
    label: "Dark",
    hint: "Always dark",
    bg: "#0a0a0b",
    fg: "#e8e8ea",
    panel: "#141416",
    accent: "#f5a524",
  },
  {
    value: "light",
    label: "Light",
    hint: "Always light",
    bg: "#e6e1ce",
    fg: "#181610",
    panel: "#efe9d4",
    accent: "#f5a524",
  },
  {
    value: "system",
    label: "Match OS",
    hint: "Follow device",
    bg: "linear-gradient(135deg,#0a0a0b 50%,#e6e1ce 50%)",
    fg: "#e8e8ea",
    panel: "#141416",
    accent: "#f5a524",
  },
] as const;

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <div className={styles.rowTitle}>{title}</div>
        {desc ? <div className={styles.rowDesc}>{desc}</div> : null}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

export function DisplaySection({ settings }: { settings: SettingsData["settings"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wired (Phase 1): default landing page persists to UserSettings.
  const [landing, setLanding] = useState(settings.defaultLanding ?? "dashboard");

  // Wired: theme persists to localStorage + <html data-theme> via next-themes.
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  // UI-only local state (not yet persisted/applied — see file header).
  const [currency, setCurrency] = useState("CAD");
  const [locale, setLocale] = useState("en-CA");
  const [dateFmt, setDateFmt] = useState<DateFmt>("iso");
  const [numFmt, setNumFmt] = useState<NumFmt>("us");
  const [density, setDensity] = useState<Density>("compact");
  const [tabularNums, setTabularNums] = useState(true);
  const [marketSession, setMarketSession] = useState(true);

  async function saveLanding(next: string) {
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
      <Panel title="Localization" meta="NOT YET APPLIED">
        <Row
          title="Display currency"
          desc="All totals are converted to this. Original transaction currency is preserved on detail rows."
        >
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ ...SELECT_STYLE, width: 180 }}
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
        <Row
          title="Locale"
          desc="Drives weekday names, currency symbol placement, and a few subtitle copies."
        >
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            style={{ ...SELECT_STYLE, width: 180 }}
          >
            {LOCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
        <Row title="Date format">
          <SegmentedControl
            label="Date format"
            value={dateFmt}
            onChange={setDateFmt}
            options={DATE_FORMAT_OPTIONS}
          />
        </Row>
        <Row title="Number format">
          <SegmentedControl
            label="Number format"
            value={numFmt}
            onChange={setNumFmt}
            options={NUMBER_FORMAT_OPTIONS}
          />
        </Row>
      </Panel>

      <Panel title="Theme">
        <div className={styles.themeGrid}>
          {THEMES.map((t) => {
            const active = mounted && theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                className={clsx(styles.themeCard, active && styles.on)}
                onClick={() => setTheme(t.value)}
              >
                <div className={styles.themePreview} style={{ background: t.bg }}>
                  <div
                    className={styles.themePvBar}
                    style={{
                      background: t.panel,
                      borderColor: t.value === "light" ? "#c3baa0" : "#1f1f23",
                    }}
                  >
                    <div className={styles.themePvDot} style={{ background: t.accent }} />
                    <div
                      className={styles.themePvLine}
                      style={{ background: t.value === "light" ? "#6c6857" : "#71717a" }}
                    />
                  </div>
                  <div className={styles.themePvNum} style={{ color: t.fg }}>
                    $54,263
                  </div>
                  <div
                    className={styles.themePvRule}
                    style={{ background: t.value === "light" ? "#d2c9ad" : "#1f1f23" }}
                  />
                  <div
                    className={styles.themePvRule}
                    style={{ background: t.value === "light" ? "#d2c9ad" : "#1f1f23" }}
                  />
                </div>
                <div className={styles.themeInfo}>
                  <div className={styles.themeName}>{t.label}</div>
                  <div className={styles.themeHint}>{t.hint}</div>
                </div>
                {active ? <span className={styles.themeCheck}>●</span> : null}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Interface">
        <Row
          title="Default landing page"
          desc="The screen you land on after signing in. The Dashboard remains reachable from the sidebar regardless."
        >
          <select
            value={landing}
            disabled={busy}
            onChange={(e) => saveLanding(e.target.value)}
            style={SELECT_STYLE}
          >
            {LANDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ErrorLine error={error} />
        </Row>
        <Row title="Row density" desc="Affects tables, lists, and the transactions log.">
          <SegmentedControl
            label="Row density"
            value={density}
            onChange={setDensity}
            options={DENSITY_OPTIONS}
          />
        </Row>
        <Row
          title="Tabular numbers"
          desc="Use fixed-width digits in number columns so values line up vertically."
        >
          <Switch isSelected={tabularNums} onChange={setTabularNums}>
            {tabularNums ? "On" : "Off"}
          </Switch>
        </Row>
        <Row
          title="Show market session in topbar"
          desc="TSX / NYSE status pill with a live clock. Hides when off."
        >
          <Switch isSelected={marketSession} onChange={setMarketSession}>
            {marketSession ? "On" : "Off"}
          </Switch>
        </Row>
      </Panel>
    </div>
  );
}
