"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Panel } from "@/components/ui";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import {
  clearOfflineSnapshots,
  getOfflineSnapshot,
  type OfflineSnapshotRecord,
} from "@/lib/pwa/offline-snapshots";

type SnapshotState = {
  dashboard: OfflineSnapshotRecord<"dashboard"> | null;
  holdings: OfflineSnapshotRecord<"holdings"> | null;
  calendar: OfflineSnapshotRecord<"calendar"> | null;
};

const EMPTY: SnapshotState = { dashboard: null, holdings: null, calendar: null };

export function OfflineSnapshotViewer() {
  const [snapshots, setSnapshots] = useState<SnapshotState>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getOfflineSnapshot("dashboard"),
      getOfflineSnapshot("holdings"),
      getOfflineSnapshot("calendar"),
    ])
      .then(([dashboard, holdings, calendar]) => {
        if (!cancelled) setSnapshots({ dashboard, holdings, calendar });
      })
      .catch(() => {
        if (!cancelled) setSnapshots(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = useMemo(
    () =>
      [
        snapshots.dashboard?.meta.savedAt,
        snapshots.holdings?.meta.savedAt,
        snapshots.calendar?.meta.savedAt,
      ]
        .filter((value): value is string => Boolean(value))
        .sort()
        .pop(),
    [snapshots]
  );

  async function clear() {
    await clearOfflineSnapshots();
    setSnapshots(EMPTY);
  }

  if (loading) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: 12 }}>
        Checking this device for saved snapshots.
      </p>
    );
  }

  if (!latest) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ color: "var(--text-3)", fontSize: 12 }}>
          No offline snapshot is saved on this device. Reconnect, enable offline snapshots in
          Settings, and open the views you want available offline.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, width: "min(960px, 100%)" }}>
      <div className="foot-note" style={{ margin: 0 }}>
        <span>Offline snapshot saved {formatRelativeTime(latest)}</span>
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear offline data
        </Button>
      </div>

      {snapshots.dashboard ? (
        <Panel
          title="Dashboard"
          meta={`SAVED ${formatRelativeTime(snapshots.dashboard.meta.savedAt)}`}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}
          >
            <OfflineMetric
              label="Net worth"
              value={formatMoney(snapshots.dashboard.data.totals.currentBalance)}
            />
            <OfflineMetric
              label="Monthly spend"
              value={formatMoney(snapshots.dashboard.data.totals.monthlySpend)}
            />
            <OfflineMetric
              label="Investments"
              value={formatMoney(snapshots.dashboard.data.investmentSummary.portfolioCAD)}
            />
          </div>
          <OfflineList
            title="Recent transactions"
            rows={snapshots.dashboard.data.recentTransactions.slice(0, 5).map((tx) => ({
              key: tx.id,
              label: tx.name,
              value: formatMoney(tx.amount),
            }))}
          />
        </Panel>
      ) : null}

      {snapshots.holdings ? (
        <Panel
          title="Holdings"
          meta={`SAVED ${formatRelativeTime(snapshots.holdings.meta.savedAt)}`}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}
          >
            <OfflineMetric
              label="Portfolio"
              value={formatMoney(snapshots.holdings.data.summary.portfolioCAD)}
            />
            <OfflineMetric
              label="Cash"
              value={formatMoney(snapshots.holdings.data.summary.cashCAD)}
            />
            <OfflineMetric
              label="Positions"
              value={String(snapshots.holdings.data.summary.positionCount)}
            />
          </div>
          <OfflineList
            title="Largest positions"
            rows={[...snapshots.holdings.data.holdings]
              .sort((a, b) => b.mvCAD - a.mvCAD)
              .slice(0, 8)
              .map((h) => ({ key: h.symbol, label: h.symbol, value: formatMoney(h.mvCAD) }))}
          />
        </Panel>
      ) : null}

      {snapshots.calendar ? (
        <Panel
          title="Calendar"
          meta={`SAVED ${formatRelativeTime(snapshots.calendar.meta.savedAt)}`}
        >
          <OfflineList
            title="Upcoming"
            rows={snapshots.calendar.data.upcomingEvents.slice(0, 10).map((event) => ({
              key: event.id,
              label: `${event.date} · ${event.title}`,
              value: event.source,
            }))}
          />
        </Panel>
      ) : null}
    </div>
  );
}

function OfflineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 12 }}>
      <div className="panel-meta">{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function OfflineList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; label: string; value: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="panel-meta" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {rows.map((row) => (
          <div key={row.key} className="foot-note" style={{ margin: 0 }}>
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
