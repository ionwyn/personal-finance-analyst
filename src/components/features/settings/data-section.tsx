"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Panel, SegmentedControl } from "@/components/ui";

import styles from "./settings.module.scss";

type Period = "30d" | "90d" | "ytd" | "12m" | "all";

function rangeFor(period: Period): { from: string; to: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  const from = new Date(today);
  switch (period) {
    case "30d":
      from.setDate(from.getDate() - 29);
      break;
    case "90d":
      from.setDate(from.getDate() - 89);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
    case "12m":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "all":
      from.setFullYear(2000, 0, 1);
      break;
  }
  return { from: iso(from), to: iso(today) };
}

export function DataSection() {
  const [period, setPeriod] = useState<Period>("90d");
  const { from, to } = rangeFor(period);
  const href = `/api/transactions/export?from=${from}&to=${to}`;

  return (
    <div className={styles.stack}>
      <Panel title="Export" meta="TRANSACTIONS · CSV">
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Period</div>
            <div className={styles.rowDesc}>
              Exports every transaction in the range with categorization, account, and metadata.
            </div>
          </div>
          <div className={styles.rowControl}>
            <SegmentedControl<Period>
              label="Export period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "30d", label: "30d" },
                { value: "90d", label: "90d" },
                { value: "ytd", label: "YTD" },
                { value: "12m", label: "12m" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
        </div>
        <div className={styles.exportGrid} style={{ marginTop: 12 }}>
          <div className={styles.exportCard}>
            <div>
              <div className={styles.exportName}>Transactions (CSV)</div>
              <div className={styles.exportDesc}>
                {from} → {to}
              </div>
            </div>
            <a className="btn" href={href} download>
              <Download size={11} />
              Download
            </a>
          </div>
        </div>
      </Panel>

      <div className={styles.placeholder}>
        <div className={styles.placeholderTag}>Phase 3</div>
        <div className={styles.placeholderTitle}>Sessions, backups & danger zone</div>
        <div className={styles.placeholderText}>
          JSON export, holdings/rules datasets, active-session management with “sign out all”, and a
          danger zone (unlink all, purge tenant) are planned for Phase 3. Token-encryption key
          rotation as mocked needs a KMS + key-versioning overhaul and is out of scope.
        </div>
      </div>
    </div>
  );
}
