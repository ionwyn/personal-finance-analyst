"use client";

import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";

import { SnapTradeSyncButton } from "@/components/actions/snaptrade-actions";
import { SegmentedControl } from "@/components/ui";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { groupOf, type ActivityGroupKey } from "@/lib/investments/activity-types";
import type { ActivityAccountOption, ActivityRow } from "@/lib/investments/activities-loader";
import type { InvestmentConnection } from "@/lib/investments/types";

import { AcctMultiFilter } from "./activity-parts/acct-multi-filter";
import { ActivityTable } from "./activity-parts/activity-table";
import {
  ErrorBanner,
  FirstTimeEmpty,
  NoConnectionCard,
  SyncBanner,
} from "./activity-parts/banners";
import { activeBrokerages, firstError, worstConnectionStatus } from "./activity-parts/format";
import { MobileActivityList } from "./activity-parts/mobile-activity-list";
import { MobileFilterSheet } from "./activity-parts/mobile-filter-sheet";
import { TypeChipFilter } from "./activity-parts/type-chip";
import { PortfolioTabs } from "./portfolio-tabs";

type Props = {
  rows: ActivityRow[];
  totalRowCount: number;
  cappedAt: number | null;
  accountOptions: ActivityAccountOption[];
  connections: InvestmentConnection[];
  lastSyncAt: string | null;
};

type SortKey = "date" | "amount" | "fees";
type SortDir = "asc" | "desc";

export function ActivityView({
  rows,
  totalRowCount,
  cappedAt,
  accountOptions,
  connections,
  lastSyncAt,
}: Props) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<ActivityGroupKey | null>(null);
  const [accts, setAccts] = useState<string[]>([]);
  const [showCAD, setShowCAD] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const status = worstConnectionStatus(connections);
  const errConn = status === "ERROR" ? firstError(connections) : null;
  const syncingConn =
    status === "SYNCING" ? (connections.find((c) => c.status === "SYNCING") ?? null) : null;
  const brokerages = activeBrokerages(connections);
  const brokerageLabel =
    brokerages.length === 1 ? brokerages[0] : `${brokerages.length} BROKERAGES`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      if (q && !`${r.symbol ?? ""} ${r.description ?? ""} ${r.type}`.toLowerCase().includes(q)) {
        return false;
      }
      if (group && groupOf(r.type) !== group) return false;
      if (accts.length > 0 && !accts.includes(r.accountId)) return false;
      return true;
    });
    return [...result].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "date") {
        av = a.tradeDate ? new Date(a.tradeDate).getTime() : 0;
        bv = b.tradeDate ? new Date(b.tradeDate).getTime() : 0;
      } else if (sortKey === "amount") {
        av = a.amount ?? 0;
        bv = b.amount ?? 0;
      } else {
        av = a.fee;
        bv = b.fee;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, group, accts, sortKey, sortDir]);

  const groupCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (q && !`${r.symbol ?? ""} ${r.description ?? ""} ${r.type}`.toLowerCase().includes(q)) {
        return false;
      }
      if (accts.length > 0 && !accts.includes(r.accountId)) return false;
      return true;
    });
    const counts: Record<string, number> = { all: base.length };
    for (const r of base) {
      const g = groupOf(r.type);
      counts[g] = (counts[g] ?? 0) + 1;
    }
    return counts;
  }, [rows, search, accts]);

  const summary = useMemo(() => {
    let net = 0;
    let fees = 0;
    let divs = 0;
    let trades = 0;
    for (const r of filtered) {
      net += r.amount ?? 0;
      fees += r.fee;
      if (groupOf(r.type) === "income") divs += r.amount ?? 0;
      if (r.type === "BUY" || r.type === "SELL") trades += 1;
    }
    return { net, fees, divs, trades };
  }, [filtered]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const sortI = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕");

  const subStatusLabel = status === "ERROR" ? "STALE" : status === "SYNCING" ? "SYNCING" : "OK";
  const subStatusColor =
    status === "ERROR" ? "var(--neg)" : status === "SYNCING" ? "var(--info)" : "var(--text-2)";

  const isFirstTimeEmpty = connections.length > 0 && totalRowCount === 0;
  const noConnection = connections.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Activity</div>
            <PortfolioTabs active="activity" />
          </div>
          <div className="page-sub">
            {totalRowCount} {totalRowCount === 1 ? "ROW" : "ROWS"} ·{" "}
            {brokerageLabel ? `${brokerageLabel.toUpperCase()} · ` : ""}
            SNAPTRADE · <span style={{ color: subStatusColor }}>{subStatusLabel}</span>
          </div>
        </div>
        <div className="page-actions">
          <SnapTradeSyncButton />
        </div>
      </div>

      {noConnection ? (
        <NoConnectionCard />
      ) : (
        <>
          {syncingConn ? <SyncBanner broker={syncingConn.institution} /> : null}
          {errConn ? <ErrorBanner code={errConn.errorCode} lastSync={errConn.lastSyncAt} /> : null}

          <div className="summary-bar">
            <div className="cell">
              <div className="lbl">Net cash flow</div>
              <div
                className="val"
                style={{ color: summary.net >= 0 ? "var(--pos)" : "var(--neg)" }}
              >
                {formatMoney(summary.net, { sign: true })}
              </div>
            </div>
            <div className="cell">
              <div className="lbl">Total fees</div>
              <div
                className="val"
                style={{ color: summary.fees > 0 ? "var(--neg)" : "var(--text)" }}
              >
                {formatMoney(-summary.fees)}
              </div>
            </div>
            <div className="cell">
              <div className="lbl">Dividend income</div>
              <div className="val" style={{ color: "var(--pos)" }}>
                {formatMoney(Math.abs(summary.divs), { sign: true })}
              </div>
            </div>
            <div className="cell">
              <div className="lbl">Trades</div>
              <div className="val">
                {summary.trades}
                <span style={{ color: "var(--text-4)", fontSize: 11, marginLeft: 6 }}>
                  BUY+SELL
                </span>
              </div>
            </div>
          </div>

          <div className="tx-toolbar act-toolbar">
            <div className="search">
              <Search size={13} style={{ color: "var(--text-3)" }} />
              <input
                placeholder="Search symbol, description, type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <AcctMultiFilter selected={accts} onChange={setAccts} options={accountOptions} />
            <button
              type="button"
              className="btn btn-sm act-filters-btn"
              onClick={() => setSheetOpen(true)}
            >
              <Filter size={12} />
              Filters
              {group || accts.length > 0 ? (
                <span className="filter-ct">{(group ? 1 : 0) + (accts.length > 0 ? 1 : 0)}</span>
              ) : null}
            </button>
            <span style={{ flex: 1 }} />
            <SegmentedControl
              label="Currency display"
              value={showCAD ? "cad" : "native"}
              onChange={(v) => setShowCAD(v === "cad")}
              options={[
                { value: "native", label: "NATIVE" },
                { value: "cad", label: "CAD" },
              ]}
            />
          </div>

          <TypeChipFilter value={group} onChange={setGroup} counts={groupCounts} />

          {isFirstTimeEmpty ? (
            <FirstTimeEmpty lastSyncAt={lastSyncAt} />
          ) : (
            <>
              <div className="panel act-panel-desktop">
                <div className="panel-head">
                  <div className="panel-title">Activity · {filtered.length}</div>
                  <div className="panel-meta">
                    SORTED BY {sortKey.toUpperCase()} {sortDir.toUpperCase()} · CLICK ROW TO EXPAND
                  </div>
                </div>
                <div
                  className="panel-body flush"
                  style={{ maxHeight: "calc(100vh - 420px)", overflow: "auto" }}
                >
                  <ActivityTable
                    rows={filtered}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                    sortI={sortI}
                    expandedId={expandedId}
                    onExpand={setExpandedId}
                  />
                </div>
              </div>

              <div className="act-panel-mobile">
                <MobileActivityList
                  rows={filtered}
                  expandedId={expandedId}
                  onExpand={setExpandedId}
                />
              </div>
            </>
          )}

          <div className="foot-note">
            <span>
              Source SnapTrade · trade-date primary · settlement T+2 typical
              {cappedAt ? ` · showing most recent ${cappedAt} of ${totalRowCount} rows` : ""}
            </span>
            <span>
              {filtered.length} {filtered.length === 1 ? "row" : "rows"} ·
              {lastSyncAt ? ` cached ${formatRelativeTime(lastSyncAt)}` : " no sync yet"}
            </span>
          </div>
        </>
      )}

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        group={group}
        setGroup={setGroup}
        accts={accts}
        setAccts={setAccts}
        acctOpts={accountOptions}
        counts={groupCounts}
      />
    </>
  );
}
