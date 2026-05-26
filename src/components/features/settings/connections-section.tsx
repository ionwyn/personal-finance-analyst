import { Panel } from "@/components/ui";
import { ItemActions } from "@/components/actions/item-actions";
import { SnapTradeConnectionActions } from "@/components/actions/snaptrade-actions";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { SyncRunRow } from "@/lib/settings/getSyncRuns";

import { CopyButton } from "./copy-button";
import styles from "./settings.module.scss";

export type ConnectionItem = {
  id: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  errorCode: string | null;
  accountCount: number;
};

export type ConnectionSnapTrade = {
  institution: string;
  status: string;
  lastSync: string | null;
  accountCount: number;
  connectionId: string | null;
};

const LOGO_PALETTE = [
  "#117ACA",
  "#016FD0",
  "#138138",
  "#6B21A8",
  "#dc2626",
  "#0891b2",
  "#f59e0b",
  "#7c3aed",
];
function logoFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  const text =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "—";
  return { bg: LOGO_PALETTE[Math.abs(h) % LOGO_PALETTE.length], text };
}

function statusPill(status: string) {
  const cls = status === "SYNCING" ? "syncing" : status === "ERROR" ? "error" : "success";
  const label = status === "ERROR" ? "RE-AUTH" : status === "SYNCING" ? "SYNCING" : "HEALTHY";
  return (
    <span className={`status ${cls}`}>
      <i className="pulse" />
      {label}
    </span>
  );
}

export function ConnectionsSection({
  items,
  snaptrade,
  syncRuns,
  webhookPath,
  isDemo,
}: {
  items: ConnectionItem[];
  snaptrade: ConnectionSnapTrade | null;
  syncRuns: SyncRunRow[];
  webhookPath: string;
  isDemo: boolean;
}) {
  return (
    <div className={styles.stack}>
      <Panel title="Sync schedule" meta="GLOBAL · APPLIES TO ALL ITEMS">
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Background sync</div>
            <div className={styles.rowDesc}>
              Runs every 6 hours via a global scheduled job, plus on-demand when Plaid sends a
              webhook. Per-item intervals are not configurable yet (deferred — see roadmap).
            </div>
          </div>
          <div className={styles.rowControl}>
            <span className="status idle">
              <i className="pulse" />
              EVERY 6H
            </span>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <div className={styles.rowTitle}>Webhook endpoint</div>
            <div className={styles.rowDesc}>
              Plaid posts ITEM_LOGIN_REQUIRED and SYNC_UPDATES_AVAILABLE here.
            </div>
          </div>
          <div className={styles.rowControl}>
            <span className={styles.endpointPill}>
              <span className={styles.liveDot} />
              <code>POST {webhookPath}</code>
            </span>
            <CopyButton value={webhookPath} />
          </div>
        </div>
      </Panel>

      <Panel title="Plaid items" meta={`${items.length} BANK CONNECTIONS`} flush>
        {items.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--text-3)" }}>
            No linked banks yet.
          </div>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Institution</th>
                <th className="num">Accounts</th>
                <th>Last sync</th>
                <th>Status</th>
                {!isDemo ? <th style={{ width: 160, textAlign: "right" }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((inst) => {
                const logo = logoFor(inst.name);
                return (
                  <tr
                    key={inst.id}
                    className={inst.status === "ERROR" ? styles.rowWarn : undefined}
                  >
                    <td>
                      <div className={styles.connLogo} style={{ background: logo.bg }}>
                        {logo.text}
                      </div>
                    </td>
                    <td>
                      <div className="t-merchant">{inst.name}</div>
                      {inst.errorCode ? (
                        <div className={styles.connErr}>{inst.errorCode}</div>
                      ) : null}
                    </td>
                    <td className="num mono">{inst.accountCount}</td>
                    <td className="mono">
                      {inst.lastSyncAt ? formatRelativeTime(inst.lastSyncAt) : "never"}
                    </td>
                    <td>{statusPill(inst.status)}</td>
                    {!isDemo ? (
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <ItemActions itemId={inst.id} status={inst.status} />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {snaptrade ? (
        <Panel title="SnapTrade brokerages" meta="1 CONNECTION" flush>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Brokerage</th>
                <th className="num">Accounts</th>
                <th>Last sync</th>
                <th>Status</th>
                {!isDemo ? <th style={{ width: 160, textAlign: "right" }}></th> : null}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className={styles.connLogo} style={{ background: "#000" }}>
                    {logoFor(snaptrade.institution).text}
                  </div>
                </td>
                <td>
                  <div className="t-merchant">{snaptrade.institution}</div>
                </td>
                <td className="num mono">{snaptrade.accountCount}</td>
                <td className="mono">
                  {snaptrade.lastSync ? formatRelativeTime(snaptrade.lastSync) : "never"}
                </td>
                <td>
                  <span className="status brokerage">
                    <i className="pulse" />
                    BROKERAGE
                  </span>
                </td>
                {!isDemo ? (
                  <td style={{ textAlign: "right" }}>
                    {snaptrade.connectionId ? (
                      <SnapTradeConnectionActions connectionId={snaptrade.connectionId} />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            </tbody>
          </table>
        </Panel>
      ) : null}

      <Panel title="Recent sync runs" meta="LAST 20" flush>
        {syncRuns.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--text-3)" }}>No sync runs yet.</div>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Started</th>
                <th>Item</th>
                <th>Source</th>
                <th>Status</th>
                <th className="num">Added</th>
                <th className="num">Modified</th>
                <th className="num">Duration</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {syncRuns.map((r) => (
                <tr key={r.id} className={r.status === "ERROR" ? styles.rowWarn : undefined}>
                  <td className="mono">{formatDateTime(r.startedAt)}</td>
                  <td>{r.institution}</td>
                  <td className="mono">{r.source}</td>
                  <td>
                    <span
                      className={`${styles.runDot} ${r.status === "SUCCESS" ? styles.pos : r.status === "ERROR" ? styles.neg : styles.inf}`}
                    >
                      ●
                    </span>
                    {r.status}
                  </td>
                  <td className="num mono">{r.added || "—"}</td>
                  <td className="num mono">{r.modified || "—"}</td>
                  <td className="num mono">{r.durationMs != null ? `${r.durationMs}ms` : "—"}</td>
                  <td
                    className="mono"
                    style={{ color: r.errorCode ? "var(--neg)" : "var(--text-4)" }}
                  >
                    {r.errorCode ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
