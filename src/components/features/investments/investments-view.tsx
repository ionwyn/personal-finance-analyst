"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { SnapTradeLinkButton, SnapTradeSyncButton } from "@/components/actions/snaptrade-actions";
import { SegmentedControl } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import type { InvestmentDashboardData, InvestmentPosition } from "@/lib/investments/types";

import { AccountsPanel } from "./investments-parts/accounts-panel";
import { AllocationPanels } from "./investments-parts/allocation-panels";
import { CashBalancesPanel } from "./investments-parts/cash-balances-panel";
import { ConnectionHealthPanel } from "./investments-parts/connection-health-panel";
import { HoldingsTable } from "./investments-parts/holdings-table";
import { SummaryBar } from "./investments-parts/summary-bar";
import type { SortDir, SortKey } from "./investments-parts/types";
import { InvestmentsTabs } from "./investments-tabs";

export function InvestmentsView({ data }: { data: InvestmentDashboardData }) {
  const { summary, accounts, connections, holdings, allocByType, allocByCcy } = data;
  const [showCAD, setShowCAD] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("mvCAD");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows: InvestmentPosition[] = holdings.filter(
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
  }, [holdings, search, sortKey, sortDir]);

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
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Investments</div>
            <InvestmentsTabs active="holdings" />
          </div>
          <div className="page-sub">
            {summary.accountCount} {summary.accountCount === 1 ? "ACCOUNT" : "ACCOUNTS"} ·{" "}
            {summary.positionCount} POSITIONS · LAST SYNC{" "}
            {formatRelativeTime(summary.lastSync).toUpperCase()} · SNAPTRADE · OK
          </div>
        </div>
        <div className="page-actions">
          <SnapTradeSyncButton />
          <SnapTradeLinkButton compact />
        </div>
      </div>

      <SummaryBar summary={summary} />

      <AllocationPanels
        allocByType={allocByType}
        allocByCcy={allocByCcy}
        fxUSDtoCAD={summary.fxUSDtoCAD}
      />

      <ConnectionHealthPanel connections={connections} />

      <AccountsPanel accounts={accounts} />

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
          label="Currency display"
          value={showCAD ? "cad" : "native"}
          onChange={(v) => setShowCAD(v === "cad")}
          options={[
            { value: "native", label: "NATIVE" },
            { value: "cad", label: "CAD" },
          ]}
        />
      </div>

      <HoldingsTable
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        sortI={sortI}
        showCAD={showCAD}
      />

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
  );
}
