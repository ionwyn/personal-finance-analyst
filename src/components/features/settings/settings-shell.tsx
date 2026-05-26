"use client";

import clsx from "clsx";
import { useState } from "react";

import { PlaidLinkButton } from "@/components/actions/plaid-link-button";
import { SyncAllButton } from "@/components/actions/sync-all-button";
import type { SettingsData } from "@/lib/cycles/getSettings";
import type { SyncRunRow } from "@/lib/settings/getSyncRuns";

import {
  ConnectionsSection,
  type ConnectionItem,
  type ConnectionSnapTrade,
} from "./connections-section";
import { AlertThresholdsSection } from "./alert-thresholds-section";
import { DataSection } from "./data-section";
import { DisplaySection } from "./display-section";
import { IncomeSourcesSection } from "./income-sources-section";
import { PayCycleSection } from "./pay-cycle-section";
import { RecurringExpensesSection } from "./recurring-expenses-section";
import { SavingsDestinationsSection } from "./savings-destinations-section";
import { SettlementPatternsSection } from "./settlement-patterns-section";
import styles from "./settings.module.scss";

const SECTIONS = [
  { id: "pay-cycle", num: "01", label: "Pay Cycle" },
  { id: "categories", num: "02", label: "Categories & Rules" },
  { id: "connections", num: "03", label: "Connections & Sync" },
  { id: "budgets", num: "04", label: "Budgets & Goals" },
  { id: "display", num: "05", label: "Display & Preferences" },
  { id: "data", num: "06", label: "Data & Account" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

const META: Record<SectionId, { title: string; sub: string }> = {
  "pay-cycle": {
    title: "Pay Cycle",
    sub: "Cadence drives budgets, allocations and the pay-cycle views. Recurring commitments accrue across cycles.",
  },
  categories: {
    title: "Categories & Rules",
    sub: "Pattern-based classification: savings destinations and settlement patterns reclassify matching transactions automatically.",
  },
  connections: {
    title: "Connections & Sync",
    sub: "Linked banks and brokerages, the sync schedule, and a log of recent sync runs.",
  },
  budgets: {
    title: "Budgets & Goals",
    sub: "Alert thresholds for category budgets. Set the actual caps and savings goals on the Budgets & Goals page.",
  },
  display: {
    title: "Display & Preferences",
    sub: "How the app opens and renders.",
  },
  data: {
    title: "Data & Account",
    sub: "Export your data and manage this tenant.",
  },
};

export type SettingsConnections = {
  items: ConnectionItem[];
  snaptrade: ConnectionSnapTrade | null;
  hasSnaptrade: boolean;
};

export function SettingsShell({
  data,
  syncRuns,
  connections,
  webhookPath,
  tenantLabel,
  isDemo,
  initialSection,
}: {
  data: SettingsData;
  syncRuns: SyncRunRow[];
  connections: SettingsConnections;
  webhookPath: string;
  tenantLabel: string;
  isDemo: boolean;
  initialSection: SectionId;
}) {
  const [active, setActive] = useState<SectionId>(initialSection);

  function go(id: SectionId) {
    setActive(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/app/settings?s=${id}`);
    }
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.railHead}>
          <div className={styles.railTitle}>Settings</div>
          <div className={styles.railSub}>{tenantLabel}</div>
        </div>
        <nav className={styles.railNav}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={clsx(styles.railItem, active === s.id && styles.on)}
              onClick={() => go(s.id)}
            >
              <span className={styles.railNum}>{s.num}</span>
              <span className={styles.railLabel}>{s.label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.railFoot}>WYN Financial · Phase 1</div>
      </aside>

      <section className={styles.pane}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionTitle}>{META[active].title}</div>
            <div className={styles.sectionSub}>{META[active].sub}</div>
          </div>
          {active === "connections" && !isDemo ? (
            <div className={styles.sectionActions}>
              <SyncAllButton
                items={connections.items.map((i) => ({ id: i.id, status: i.status }))}
                hasSnaptrade={connections.hasSnaptrade}
              />
              <PlaidLinkButton />
            </div>
          ) : null}
        </div>

        {active === "pay-cycle" ? (
          <div className={styles.stack}>
            <PayCycleSection settings={data.settings} />
            <IncomeSourcesSection sources={data.incomeSources} />
            <RecurringExpensesSection expenses={data.recurringExpenses} />
          </div>
        ) : null}

        {active === "categories" ? (
          <div className={styles.stack}>
            <SavingsDestinationsSection destinations={data.savingsDestinations} />
            <SettlementPatternsSection patterns={data.settlementPatterns} />
            <div className={styles.placeholder}>
              <div className={styles.placeholderTag}>Phase 2</div>
              <div className={styles.placeholderTitle}>Custom categories & auto-rules</div>
              <div className={styles.placeholderText}>
                Categories currently come from Plaid&apos;s taxonomy. A user-defined category system
                was removed previously in favour of this — re-introducing custom categories,
                per-merchant rules and manual overrides is a Phase 2 decision pending review.
              </div>
            </div>
          </div>
        ) : null}

        {active === "connections" ? (
          <ConnectionsSection
            items={connections.items}
            snaptrade={connections.snaptrade}
            syncRuns={syncRuns}
            webhookPath={webhookPath}
            isDemo={isDemo}
          />
        ) : null}

        {active === "budgets" ? (
          <div className={styles.stack}>
            <AlertThresholdsSection settings={data.settings} />
          </div>
        ) : null}

        {active === "display" ? <DisplaySection settings={data.settings} /> : null}
        {active === "data" ? <DataSection /> : null}
      </section>
    </div>
  );
}
