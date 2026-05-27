"use client";

import clsx from "clsx";
import { Download, KeyRound, Unlink } from "lucide-react";
import { useState } from "react";

import { Panel, SegmentedControl } from "@/components/ui";

import { INPUT_STYLE } from "./settings-form";
import styles from "./settings.module.scss";

/*
 * Phase 3 — Data & Account (UI scaffold, from the TD Personal Finance design).
 *
 * Wired: the existing CSV transaction export (period → /api/transactions/export).
 * Everything else is an intentional UI preview — not wired yet:
 *   - non-CSV formats + the holdings/categories/backup datasets,
 *   - Security (token-encryption rotation, sessions),
 *   - Danger zone (unlink-all, purge tenant).
 * The token-encryption copy is kept truthful (AES-256-GCM via a single env key;
 * the mockup's KMS "rotated 47d ago" is fictional, so it's not shown).
 */

type Period = "30D" | "90D" | "ytd" | "12M" | "all";
type Format = "csv" | "json" | "xlsx" | "ofx";

function rangeFor(period: Period): { from: string; to: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  const from = new Date(today);
  switch (period) {
    case "30D":
      from.setDate(from.getDate() - 29);
      break;
    case "90D":
      from.setDate(from.getDate() - 89);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
    case "12M":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "all":
      from.setFullYear(2000, 0, 1);
      break;
  }
  return { from: iso(from), to: iso(today) };
}

const DATASETS = [
  {
    id: "transactions",
    name: "Transactions",
    desc: "Every transaction with categorization, account, and metadata.",
    size: "CSV",
  },
  {
    id: "holdings",
    name: "Holdings & positions",
    desc: "All investment positions, average cost, and P&L history.",
    size: "soon",
  },
  {
    id: "rules",
    name: "Categories & rules",
    desc: "Savings destinations, settlement patterns, and income sources.",
    size: "soon",
  },
  {
    id: "backup",
    name: "Full tenant backup",
    desc: "Everything above plus balances, goals, budgets, and preferences.",
    size: "soon",
  },
] as const;

export function DataSection({ tenantLabel, isDemo }: { tenantLabel: string; isDemo: boolean }) {
  const [period, setPeriod] = useState<Period>("ytd");
  const [format, setFormat] = useState<Format>("csv");
  const [confirm, setConfirm] = useState("");

  const { from, to } = rangeFor(period);
  const csvHref = `/api/transactions/export?from=${from}&to=${to}`;

  return (
    <div className={styles.stack}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span className={styles.tenantChip}>
          tenant <code>{tenantLabel}</code>
        </span>
      </div>

      <Panel title="Export" meta={`PORTABLE · ${format.toUpperCase()}`}>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Period</div>
            <div className={styles.rowDesc}>Date range applied to the transactions export.</div>
          </div>
          <div className={styles.rowControl}>
            <SegmentedControl<Period>
              label="Export period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "30D", label: "30D" },
                { value: "90D", label: "90D" },
                { value: "ytd", label: "YTD" },
                { value: "12M", label: "12M" },
                { value: "all", label: "All time" },
              ]}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Format</div>
            <div className={styles.rowDesc}>CSV is available today; JSON/XLSX/OFX are planned.</div>
          </div>
          <div className={styles.rowControl}>
            <SegmentedControl<Format>
              label="Export format"
              value={format}
              onChange={setFormat}
              options={[
                { value: "csv", label: "CSV" },
                { value: "json", label: "JSON" },
                { value: "xlsx", label: "XLSX" },
                { value: "ofx", label: "OFX" },
              ]}
            />
          </div>
        </div>

        <div className={styles.exportGrid} style={{ marginTop: 12 }}>
          {DATASETS.map((d) => {
            const ready = d.id === "transactions" && format === "csv";
            return (
              <div key={d.id} className={styles.exportCard}>
                <div>
                  <div className={styles.exportName}>{d.name}</div>
                  <div className={styles.exportDesc}>{d.desc}</div>
                  <div className={styles.exportSize}>
                    {ready ? `${from} → ${to}` : "Not available yet"}
                  </div>
                </div>
                {ready ? (
                  <a className="btn btn-sm" href={csvHref} download>
                    <Download size={11} />
                    Export
                  </a>
                ) : (
                  <button className="btn btn-sm" type="button" disabled title="Not available yet">
                    <Download size={11} />
                    Export
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Security" meta="PREVIEW · NOT WIRED">
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Token encryption</div>
            <div className={styles.rowDesc}>
              Plaid &amp; SnapTrade access tokens are encrypted at rest with AES-256-GCM. Today this
              uses a single static env key; rotation would need key-versioning (KMS) work.
            </div>
          </div>
          <div className={styles.rowControl}>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
              AES-256-GCM
            </span>
            <button
              className="btn btn-sm"
              type="button"
              disabled
              title="Requires KMS — not available"
            >
              <KeyRound size={11} />
              Rotate
            </button>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Sessions</div>
            <div className={styles.rowDesc}>
              Active sessions across devices. Signing out everywhere invalidates all sessions.
            </div>
          </div>
          <div className={styles.rowControl}>
            <button className="btn btn-sm" type="button" disabled title="Not available yet">
              Sign out all
            </button>
          </div>
        </div>
      </Panel>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHead}>
          <div>
            <div className={styles.dangerTitle}>Danger zone</div>
            <div className={styles.dangerSub}>
              Destructive, irreversible actions. Preview only — not wired up yet.
            </div>
          </div>
          <div className={styles.dangerBadge}>IRREVERSIBLE</div>
        </div>

        <div className={styles.dangerRow}>
          <div className={styles.dangerRowInfo}>
            <div className={styles.dangerRowTitle}>Unlink all institutions</div>
            <div className={styles.dangerRowDesc}>
              Revoke and remove every linked Plaid bank and SnapTrade brokerage in one go.
            </div>
          </div>
          <button
            className={clsx("btn", "btn-sm", styles.btnDangerSolid)}
            type="button"
            disabled
            title="Not available yet"
          >
            <Unlink size={11} />
            Unlink all
          </button>
        </div>

        <div className={clsx(styles.dangerRow, styles.dangerRowTall)}>
          <div className={styles.dangerRowInfo}>
            <div className={styles.dangerRowTitle}>Purge tenant data</div>
            <div className={styles.dangerRowDesc}>
              Deletes every transaction, holding, rule, goal, and budget for this tenant. Cannot be
              undone.
            </div>
            <div className={styles.dangerConfirm}>
              <span className={styles.dangerConfirmLabel}>
                Type <code>purge</code> to enable:
              </span>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="purge"
                style={{ ...INPUT_STYLE, width: 120 }}
                disabled={isDemo}
              />
            </div>
          </div>
          <button
            className={clsx("btn", "btn-sm", styles.btnDangerSolid)}
            type="button"
            disabled={isDemo || confirm !== "purge"}
            title="Preview — not wired yet"
          >
            Purge everything
          </button>
        </div>
      </div>
    </div>
  );
}
