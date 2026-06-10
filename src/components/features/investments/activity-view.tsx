"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";

import { SnapTradeSyncButton } from "@/components/actions/snaptrade-actions";
import { SymLogo } from "@/components/shared/sym-logo";
import { SegmentedControl } from "@/components/ui";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import {
  ACTIVITY_GROUPS,
  groupOf,
  shortLabel,
  type ActivityGroupKey,
} from "@/lib/investments/activity-types";
import type { ActivityAccountOption, ActivityRow } from "@/lib/investments/activities-loader";
import type { ConnectionStatus, InvestmentConnection } from "@/lib/investments/types";

import { InvestmentsTabs } from "./investments-tabs";

type Props = {
  rows: ActivityRow[];
  totalRowCount: number;
  cappedAt: number | null;
  accountOptions: ActivityAccountOption[];
  connections: InvestmentConnection[];
  lastSyncAt: string | null;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dateDay(iso: string | null) {
  if (!iso) return "—";
  return String(new Date(iso).getUTCDate()).padStart(2, "0");
}

function dateMonth(iso: string | null) {
  if (!iso) return "";
  return MONTH_NAMES[new Date(iso).getUTCMonth()] ?? "";
}

function dateFull(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}, ${d.getUTCFullYear()}`;
}

function worstConnectionStatus(connections: InvestmentConnection[]): ConnectionStatus {
  if (connections.some((c) => c.status === "ERROR")) return "ERROR";
  if (connections.some((c) => c.status === "SYNCING")) return "SYNCING";
  if (connections.some((c) => c.status === "DISABLED")) return "DISABLED";
  return "IDLE";
}

function firstError(connections: InvestmentConnection[]) {
  return connections.find((c) => c.status === "ERROR") ?? null;
}

function activeBrokerages(connections: InvestmentConnection[]) {
  return [...new Set(connections.map((c) => c.institution))].filter(Boolean);
}

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
  const [sortKey, setSortKey] = useState<"date" | "amount" | "fees">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const status = worstConnectionStatus(connections);
  const errConn = status === "ERROR" ? firstError(connections) : null;
  const syncingConn =
    status === "SYNCING" ? (connections.find((c) => c.status === "SYNCING") ?? null) : null;
  const brokerages = activeBrokerages(connections);
  const brokerageLabel =
    brokerages.length === 1 ? brokerages[0] : `${brokerages.length} BROKERAGES`;

  // Filter + sort
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

  // Group counts (independent of group filter; depends on search + accts)
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

  // Summary rollups from filtered set
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

  const onSort = (k: "date" | "amount" | "fees") => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const sortI = (k: "date" | "amount" | "fees") =>
    sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕";

  const subStatusLabel = status === "ERROR" ? "STALE" : status === "SYNCING" ? "SYNCING" : "OK";
  const subStatusColor =
    status === "ERROR" ? "var(--neg)" : status === "SYNCING" ? "var(--info)" : "var(--text-2)";

  // First-time empty: connections exist but no activity rows
  const isFirstTimeEmpty = connections.length > 0 && totalRowCount === 0;
  const noConnection = connections.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Investments</div>
            <InvestmentsTabs active="activity" />
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

// ─── Type chip ──────────────────────────────────────────────────────────
function TypeChip({ type }: { type: string }) {
  const g = ACTIVITY_GROUPS[groupOf(type)];
  return (
    <span className={`type-chip g-${g.key}`} title={`${type} · ${g.name}`}>
      <i className="dot" style={{ background: g.color }} />
      {shortLabel(type)}
    </span>
  );
}

// ─── Type chip filter row ───────────────────────────────────────────────
function TypeChipFilter({
  value,
  onChange,
  counts,
}: {
  value: ActivityGroupKey | null;
  onChange: (v: ActivityGroupKey | null) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="type-filter">
      <button
        type="button"
        className={"tf-chip all " + (!value ? "on" : "")}
        onClick={() => onChange(null)}
      >
        All <span className="ct">{counts.all ?? 0}</span>
      </button>
      {Object.values(ACTIVITY_GROUPS)
        .filter((g) => g.key !== "other")
        .map((g) => (
          <button
            type="button"
            key={g.key}
            className={"tf-chip " + (value === g.key ? "on" : "")}
            onClick={() => onChange(g.key)}
          >
            <i className="dot" style={{ background: g.color }} />
            {g.name}
            <span className="ct">{counts[g.key] ?? 0}</span>
          </button>
        ))}
    </div>
  );
}

// ─── Account multi-select ──────────────────────────────────────────────
function AcctMultiFilter({
  selected,
  onChange,
  options,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  options: ActivityAccountOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);
  const all = selected.length === 0 || selected.length === options.length;
  const label =
    all || options.length === 0
      ? "All accounts"
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? "1 account")
        : `${selected.length} accounts`;
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={"filter-pill " + (!all ? "active" : "")}
        onClick={() => setOpen((o) => !o)}
        disabled={options.length === 0}
      >
        {label}
        <ChevronDown size={10} style={{ opacity: 0.6, marginLeft: 4 }} />
      </button>
      {open && options.length > 0 ? (
        <div className="dd-panel">
          {options.map((o) => {
            const on = selected.length === 0 || selected.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                className={"dd-item " + (on ? "on" : "")}
                onClick={() => toggle(o.id)}
              >
                <span className="cb">{on ? "✓" : ""}</span>
                <span className="nm">{o.institution}</span>
                <span className="reg">· {o.label}</span>
              </button>
            );
          })}
          <div className="dd-foot">
            <button type="button" onClick={() => onChange([])}>
              All
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Account badge ──────────────────────────────────────────────────────
function AcctBadge({ row }: { row: ActivityRow }) {
  return (
    <span className="acct-badge dense">
      <i className="logo" style={{ background: row.institutionLogoBg }}>
        {row.institutionLogoText}
      </i>
      <span className="reg">{row.accountLabel}</span>
    </span>
  );
}

// ─── Amount cell ────────────────────────────────────────────────────────
function FmtAmount({ value, ccy }: { value: number | null; ccy?: string }) {
  if (value == null || value === 0) {
    return <span style={{ color: "var(--text-4)" }}>—</span>;
  }
  const pos = value > 0;
  return (
    <span className={pos ? "amt-pos" : "amt-neg"}>
      {formatMoney(value, { sign: true })}
      {ccy ? <span className="ccy-suffix"> {ccy}</span> : null}
    </span>
  );
}

// ─── Activity table (desktop) ───────────────────────────────────────────
function ActivityTable({
  rows,
  sortKey,
  onSort,
  sortI,
  expandedId,
  onExpand,
}: {
  rows: ActivityRow[];
  sortKey: "date" | "amount" | "fees";
  sortDir: "asc" | "desc";
  onSort: (k: "date" | "amount" | "fees") => void;
  sortI: (k: "date" | "amount" | "fees") => string;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
}) {
  return (
    <table className="table act-table">
      <thead>
        <tr>
          <th
            className={"sortable " + (sortKey === "date" ? "active" : "")}
            onClick={() => onSort("date")}
            style={{ width: 88 }}
          >
            Date <span className="sort-i">{sortI("date")}</span>
          </th>
          <th style={{ width: 110 }}>Type</th>
          <th style={{ width: 132 }}>Symbol</th>
          <th>Description</th>
          <th className="num" style={{ width: 80 }}>
            Units
          </th>
          <th className="num" style={{ width: 84 }}>
            Price
          </th>
          <th
            className={"num sortable " + (sortKey === "amount" ? "active" : "")}
            onClick={() => onSort("amount")}
            style={{ width: 124 }}
          >
            Amount <span className="sort-i">{sortI("amount")}</span>
          </th>
          <th
            className={"num sortable " + (sortKey === "fees" ? "active" : "")}
            onClick={() => onSort("fees")}
            style={{ width: 72 }}
          >
            Fees <span className="sort-i">{sortI("fees")}</span>
          </th>
          <th style={{ width: 100 }}>Account</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isOpen = expandedId === r.id;
          const cashOnly = r.units == null;
          return (
            <Fragment key={r.id}>
              <tr
                className={"act-row " + (isOpen ? "open" : "")}
                onClick={() => onExpand(isOpen ? null : r.id)}
              >
                <td className="t-date">
                  <span className="dt-day">{dateDay(r.tradeDate)}</span>
                  <span className="dt-mo">{dateMonth(r.tradeDate)}</span>
                </td>
                <td>
                  <TypeChip type={r.type} />
                </td>
                <td>
                  {r.symbol ? (
                    <div className="sym-cell">
                      <SymLogo symbol={r.symbol} bg={r.symbolLogoBg ?? "#1f3a93"} />
                      <span className="ticker">{r.symbol}</span>
                    </div>
                  ) : (
                    <span className="sym-none">—</span>
                  )}
                </td>
                <td className="desc-cell">
                  <span className="desc-trunc">{r.description ?? "—"}</span>
                </td>
                <td className="num">
                  {cashOnly ? (
                    <span style={{ color: "var(--text-4)" }}>—</span>
                  ) : (
                    (r.units ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 })
                  )}
                </td>
                <td className="num" style={{ color: "var(--text-3)" }}>
                  {r.price == null ? (
                    <span style={{ color: "var(--text-4)" }}>—</span>
                  ) : (
                    r.price.toFixed(2)
                  )}
                </td>
                <td className="num">
                  <FmtAmount value={r.amount} />
                  <span className="ccy-tag mini">{r.currency}</span>
                </td>
                <td className="num">
                  {r.fee > 0 ? (
                    <span className="fee-cell">−${r.fee.toFixed(2)}</span>
                  ) : (
                    <span style={{ color: "var(--text-4)" }}>—</span>
                  )}
                </td>
                <td>
                  <AcctBadge row={r} />
                </td>
              </tr>
              {isOpen ? (
                <tr className="act-row-detail-wrap">
                  <td colSpan={9} style={{ padding: 0 }}>
                    <RowDetail row={r} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
        {rows.length === 0 ? (
          <tr>
            <td colSpan={9} style={{ padding: 0 }}>
              <EmptyFilterRow />
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

// ─── Mobile cards ───────────────────────────────────────────────────────
function MobileActivityList({
  rows,
  expandedId,
  onExpand,
}: {
  rows: ActivityRow[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
}) {
  if (rows.length === 0) return <EmptyFilterRow />;
  return (
    <div className="act-mobile-list">
      {rows.map((r) => {
        const isOpen = expandedId === r.id;
        return (
          <div
            key={r.id}
            className={"act-card " + (isOpen ? "open" : "")}
            onClick={() => onExpand(isOpen ? null : r.id)}
          >
            <div className="row-1">
              <span className="dt">
                {dateMonth(r.tradeDate)} {dateDay(r.tradeDate)}
              </span>
              {r.symbol ? (
                <span className="sym">
                  <SymLogo symbol={r.symbol} bg={r.symbolLogoBg ?? "#1f3a93"} />
                  <span className="ticker">{r.symbol}</span>
                </span>
              ) : (
                <span className="sym none">—</span>
              )}
              <span className="amt">
                <FmtAmount value={r.amount} />
                <span className="ccy">{r.currency}</span>
              </span>
            </div>
            <div className="row-2">
              <TypeChip type={r.type} />
              <AcctBadge row={r} />
              {r.fee > 0 ? <span className="fee">FEE −${r.fee.toFixed(2)}</span> : null}
              <span className="desc-trunc">{r.description ?? ""}</span>
            </div>
            {isOpen ? <RowDetail row={r} /> : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Row detail (expand) ───────────────────────────────────────────────
function RowDetail({ row }: { row: ActivityRow }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && row.externalReferenceId) {
      navigator.clipboard.writeText(row.externalReferenceId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const fields: [string, React.ReactNode][] = [
    [
      "Description",
      <span key="d" className="desc-full">
        {row.description ?? "—"}
      </span>,
    ],
    ["Trade date", dateFull(row.tradeDate)],
    ["Settlement", dateFull(row.settlementDate)],
    ["Account", `${row.institution} · ${row.accountLabel}`],
  ];
  if (row.units != null) {
    fields.push(["Units", row.units.toLocaleString("en-US", { maximumFractionDigits: 4 })]);
  }
  if (row.price != null) {
    fields.push(["Price", `$${row.price.toFixed(2)} ${row.currency}`]);
  }
  fields.push(["Amount", <FmtAmount key="a" value={row.amount} ccy={row.currency} />]);
  if (row.fee > 0) {
    fields.push([
      "Fees",
      <span key="f" className="amt-neg">
        −${row.fee.toFixed(2)} <span className="ccy-suffix">{row.currency}</span>
      </span>,
    ]);
  }
  if (row.fxRate) {
    fields.push(["FX rate", `1 ${row.currency} = ${row.fxRate.toFixed(4)} CAD`]);
  }
  fields.push([
    "External ref",
    <span key="x" className="ext-ref-wrap">
      <code className="ext-ref">{row.externalReferenceId ?? "—"}</code>
      {row.externalReferenceId ? (
        <button type="button" className="copy-btn" onClick={copy}>
          {copied ? "COPIED" : "COPY"}
        </button>
      ) : null}
    </span>,
  ]);

  return (
    <div className="act-detail">
      <div className="dl">
        {fields.map(([k, v]) => (
          <div className="dl-row" key={k}>
            <div className="dl-k">{k}</div>
            <div className="dl-v">{v}</div>
          </div>
        ))}
      </div>
      {row.symbol ? (
        <div className="dl-foot">
          <span className="dl-foot-meta">
            Symbol detail page ships with the next investment feature
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ─── States ─────────────────────────────────────────────────────────────
function SyncBanner({ broker }: { broker: string }) {
  return (
    <div className="act-banner syncing">
      <i className="pulse" />
      <span className="lbl">REFRESHING ACTIVITY FROM {broker.toUpperCase()}</span>
      <span className="meta">Existing rows shown · new activity will appear when complete</span>
    </div>
  );
}

function ErrorBanner({ code, lastSync }: { code: string | null; lastSync: string | null }) {
  return (
    <div className="act-banner err">
      <i className="dot" />
      <span className="lbl">SYNC FAILED · {code ?? "UNKNOWN"}</span>
      <span className="meta">
        {lastSync
          ? `Last successful sync ${formatRelativeTime(lastSync)} · showing cached data`
          : "No successful sync yet"}
      </span>
    </div>
  );
}

function NoConnectionCard() {
  return (
    <div className="panel act-no-conn">
      <div className="hd">
        <div>
          <div className="title">No brokerage connected</div>
          <div className="sub">
            Link a brokerage via SnapTrade to start importing buys, sells, dividends, and
            contributions.
          </div>
        </div>
      </div>
      <div className="bd">
        <ul className="bullets">
          <li>Read-only — we never place trades.</li>
          <li>Initial backfill depends on your brokerage; we pull up to 24 months of history.</li>
          <li>Syncs every 6 hours; manual refresh on the Holdings tab.</li>
        </ul>
      </div>
    </div>
  );
}

function FirstTimeEmpty({ lastSyncAt }: { lastSyncAt: string | null }) {
  return (
    <div className="panel act-empty-panel">
      <div className="emp-title">No activity yet</div>
      <div className="emp-sub">
        Your brokerage is connected but no activity has been pulled in.
        <br />
        Some institutions take up to 24 hours to backfill — try a manual sync, or check again later.
      </div>
      <div className="emp-meta">
        {lastSyncAt ? `Last sync ${formatRelativeTime(lastSyncAt)}` : "No sync recorded yet"}
      </div>
    </div>
  );
}

function EmptyFilterRow() {
  return (
    <div className="act-empty inline">
      <div className="title">No activity matches these filters</div>
      <div className="sub">
        Try widening the date range, clearing the type chip, or adding more accounts.
      </div>
    </div>
  );
}

// ─── Mobile filter sheet ───────────────────────────────────────────────
function MobileFilterSheet({
  open,
  onClose,
  group,
  setGroup,
  accts,
  setAccts,
  acctOpts,
  counts,
}: {
  open: boolean;
  onClose: () => void;
  group: ActivityGroupKey | null;
  setGroup: (g: ActivityGroupKey | null) => void;
  accts: string[];
  setAccts: (v: string[]) => void;
  acctOpts: ActivityAccountOption[];
  counts: Record<string, number>;
}) {
  if (!open) return null;
  return (
    <div className="act-sheet-scrim" onClick={onClose}>
      <div className="act-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sh-head">
          <div className="sh-title">Filters</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={12} />
          </button>
        </div>
        <div className="sh-section">
          <div className="sh-lbl">Type</div>
          <div className="sh-types">
            <button
              type="button"
              className={"tf-chip all " + (!group ? "on" : "")}
              onClick={() => setGroup(null)}
            >
              All <span className="ct">{counts.all ?? 0}</span>
            </button>
            {Object.values(ACTIVITY_GROUPS)
              .filter((g) => g.key !== "other")
              .map((g) => (
                <button
                  type="button"
                  key={g.key}
                  className={"tf-chip " + (group === g.key ? "on" : "")}
                  onClick={() => setGroup(g.key)}
                >
                  <i className="dot" style={{ background: g.color }} />
                  {g.name} <span className="ct">{counts[g.key] ?? 0}</span>
                </button>
              ))}
          </div>
        </div>
        <div className="sh-section">
          <div className="sh-lbl">Accounts</div>
          {acctOpts.map((o) => {
            const on = accts.length === 0 || accts.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                className={"sh-acct " + (on ? "on" : "")}
                onClick={() => {
                  if (accts.includes(o.id)) setAccts(accts.filter((x) => x !== o.id));
                  else setAccts([...accts, o.id]);
                }}
              >
                <span className="cb">{on ? "✓" : ""}</span>
                {o.institution} · {o.label}
              </button>
            );
          })}
        </div>
        <div className="sh-foot">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setGroup(null);
              setAccts([]);
            }}
          >
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
