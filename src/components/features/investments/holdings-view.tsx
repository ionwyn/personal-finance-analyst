"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { SnapTradeLinkButton, SnapTradeSyncButton } from "@/components/actions/snaptrade-actions";
import { OfflineSnapshotWriter } from "@/components/pwa/offline-snapshot-writer";
import { SegmentedControl } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import type {
  InvestmentAccount,
  InvestmentDashboardData,
  InvestmentPosition,
} from "@/lib/investments/types";

import { CashBalancesPanel } from "./investments-parts/cash-balances-panel";
import { HoldingsHeatmap, type HeatmapGroupBy } from "./investments-parts/holdings-heatmap";
import { HoldingsTable } from "./investments-parts/holdings-table";
import { mergePositionsBySymbol } from "./investments-parts/merge-positions";
import type { SortDir, SortKey, ViewMode } from "./investments-parts/types";
import { PortfolioTabs } from "./portfolio-tabs";

type DisplayMode = "list" | "heatmap";

export function HoldingsView({ data }: { data: InvestmentDashboardData }) {
  const { summary, holdings, accounts, sectorBySymbol } = data;
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [showCAD, setShowCAD] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const [sortKey, setSortKey] = useState<SortKey>("mvCAD");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<HeatmapGroupBy>("mv");

  const router = useRouter();
  const handleNavigate = useCallback(
    (symbol: string) => router.push(`/app/portfolio/${encodeURIComponent(symbol)}` as never),
    [router]
  );

  const accountMap = useMemo(
    () => new Map<string, InvestmentAccount>(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const sorted = useMemo(() => {
    const base = viewMode === "unified" ? mergePositionsBySymbol(holdings) : holdings;
    const q = search.trim().toLowerCase();
    let rows: InvestmentPosition[] = base.filter(
      (h) => !q || `${h.symbol} ${h.description} ${h.type}`.toLowerCase().includes(q)
    );
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return rows;
  }, [holdings, search, sortKey, sortDir, viewMode]);

  const byAccountGroups = useMemo(() => {
    if (viewMode !== "by-account") return null;
    const groups = new Map<string, InvestmentPosition[]>();
    for (const row of sorted) {
      const existing = groups.get(row.accountId);
      if (existing) existing.push(row);
      else groups.set(row.accountId, [row]);
    }
    return Array.from(groups.entries())
      .filter(([, rows]) => rows.length > 0)
      .map(([accountId, rows]) => ({ account: accountMap.get(accountId), rows }));
  }, [sorted, viewMode, accountMap]);

  const heatmapRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return holdings;
    return holdings.filter((h) =>
      `${h.symbol} ${h.description} ${h.type}`.toLowerCase().includes(q)
    );
  }, [holdings, search]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };
  const sortI = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕");

  return (
    <>
      <OfflineSnapshotWriter kind="holdings" data={data} />
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Holdings</div>
            <PortfolioTabs active="holdings" />
          </div>
          <div className="page-sub">
            {summary.positionCount} POSITIONS · LAST SYNC{" "}
            {formatRelativeTime(summary.lastSync).toUpperCase()}
          </div>
        </div>
        <div className="page-actions">
          <SnapTradeSyncButton />
          <SnapTradeLinkButton compact />
        </div>
      </div>

      <div className="tx-toolbar" style={{ paddingTop: 4 }}>
        <div className="search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Search symbol, description, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ flex: 1 }} />
        <SegmentedControl
          label="Display mode"
          value={displayMode}
          onChange={(v) => setDisplayMode(v as DisplayMode)}
          options={[
            { value: "list", label: "LIST" },
            { value: "heatmap", label: "HEATMAP" },
          ]}
        />
        {displayMode === "list" ? (
          <>
            <SegmentedControl
              label="View"
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { value: "unified", label: "UNIFIED" },
                { value: "by-account", label: "BY ACCOUNT" },
              ]}
            />
            <SegmentedControl
              label="Currency display"
              value={showCAD ? "cad" : "native"}
              onChange={(v) => setShowCAD(v === "cad")}
              options={[
                { value: "native", label: "NATIVE" },
                { value: "cad", label: "CAD" },
              ]}
            />
          </>
        ) : (
          <SegmentedControl
            label="Group by"
            value={groupBy}
            onChange={(v) => setGroupBy(v as HeatmapGroupBy)}
            options={[
              { value: "mv", label: "MV" },
              { value: "sector", label: "SECTOR" },
            ]}
          />
        )}
      </div>

      {displayMode === "list" ? (
        <>
          {byAccountGroups ? (
            byAccountGroups.map(({ account, rows }) => (
              <HoldingsTable
                key={account?.id ?? "unknown"}
                title={
                  account
                    ? `${account.name} · ${account.registration} · ${rows.length}`
                    : `Unknown Account · ${rows.length}`
                }
                rows={rows}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sortI={sortI}
                showCAD={showCAD}
              />
            ))
          ) : (
            <HoldingsTable
              rows={sorted}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              sortI={sortI}
              showCAD={showCAD}
            />
          )}
          <CashBalancesPanel cashByCcy={summary.cashByCcy} />
          <div className="foot-note">
            <span>SnapTrade positions cached {formatRelativeTime(summary.lastSync)}</span>
            <span>
              Click column headers to sort · NATIVE/CAD toggle preserves listing currency
              {summary.omittedPositionCount > 0
                ? ` · ${summary.omittedPositionCount} positions omitted`
                : ""}
            </span>
          </div>
        </>
      ) : (
        <>
          <HoldingsHeatmap
            rows={heatmapRows}
            sectorBySymbol={sectorBySymbol}
            groupBy={groupBy}
            onNavigate={handleNavigate}
          />
          <CashBalancesPanel cashByCcy={summary.cashByCcy} />
          <div className="foot-note">
            <span>SnapTrade positions cached {formatRelativeTime(summary.lastSync)}</span>
            <span>
              Sized by market value (CAD) · colored by P&amp;L% · click to open position
              {summary.omittedPositionCount > 0
                ? ` · ${summary.omittedPositionCount} positions omitted`
                : ""}
            </span>
          </div>
        </>
      )}
    </>
  );
}
