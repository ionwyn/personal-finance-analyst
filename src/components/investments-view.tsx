"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { SnapTradeLinkButton, SnapTradeSyncButton } from "@/components/snaptrade-actions";
import { SymLogo } from "@/components/sym-logo";
import type {
  InvestmentDashboardData,
  InvestmentPosition
} from "@/lib/investments/types";

type SortKey =
  | "symbol"
  | "units"
  | "avgCost"
  | "price"
  | "mvCAD"
  | "plCAD"
  | "plPct";

type SortDir = "asc" | "desc";

const fmt2 = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatRelative(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatOpened(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function InvestmentsView({ data }: { data: InvestmentDashboardData }) {
  const { summary, accounts, holdings, allocByType, allocByCcy } = data;
  const [showCAD, setShowCAD] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("mvCAD");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows: InvestmentPosition[] = holdings.filter((h) =>
      !q ||
      `${h.symbol} ${h.description} ${h.type}`.toLowerCase().includes(q)
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
  const sortI = (k: SortKey) =>
    sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕";

  const plPos = summary.plCAD >= 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Investments</div>
          <div className="page-sub">
            {summary.accountCount} {summary.accountCount === 1 ? "ACCOUNT" : "ACCOUNTS"} ·{" "}
            {summary.positionCount} POSITIONS · LAST SYNC{" "}
            {formatRelative(summary.lastSync).toUpperCase()} · SNAPTRADE · OK
          </div>
        </div>
        <div className="page-actions">
          <SnapTradeSyncButton />
          <SnapTradeLinkButton compact />
        </div>
      </div>

      <div className="summary-bar">
        <div className="cell">
          <div className="lbl">Portfolio · CAD</div>
          <div className="val">${fmt2(summary.portfolioCAD)}</div>
        </div>
        <div className="cell">
          <div className="lbl">Open P&amp;L</div>
          <div className="val" style={{ color: plPos ? "var(--pos)" : "var(--neg)" }}>
            {plPos ? "+" : "−"}${fmt2(Math.abs(summary.plCAD))}
          </div>
        </div>
        <div className="cell">
          <div className="lbl">Open P&amp;L %</div>
          <div className="val" style={{ color: plPos ? "var(--pos)" : "var(--neg)" }}>
            {plPos ? "+" : "−"}
            {Math.abs(summary.plPct).toFixed(2)}%
          </div>
        </div>
        <div className="cell">
          <div className="lbl">Cash · CAD-eq.</div>
          <div className="val">${fmt2(summary.cashCAD)}</div>
        </div>
      </div>

      <div className="alloc-grid">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Allocation · Asset type</div>
            <div className="panel-meta">{allocByType.length} TYPES</div>
          </div>
          <div className="panel-body">
            <div className="alloc-bar">
              {allocByType.map((a) => (
                <div
                  key={a.name}
                  className="seg"
                  style={{ width: `${a.pct}%`, background: a.color }}
                  title={`${a.name} ${a.pct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="alloc-list">
              {allocByType.map((a) => (
                <div className="alloc-row" key={a.name}>
                  <i className="sw" style={{ background: a.color }} />
                  <span className="nm">{a.name}</span>
                  <span className="pct">{a.pct.toFixed(1)}%</span>
                  <span className="v">
                    ${a.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Allocation · Currency</div>
            <div className="panel-meta">FX EXPOSURE</div>
          </div>
          <div className="panel-body">
            <div className="alloc-bar">
              {allocByCcy.map((a) => (
                <div
                  key={a.name}
                  className="seg"
                  style={{ width: `${a.pct}%`, background: a.color }}
                  title={`${a.name} ${a.pct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="alloc-list">
              {allocByCcy.map((a) => (
                <div className="alloc-row" key={a.name}>
                  <i className="sw" style={{ background: a.color }} />
                  <span className="nm">{a.name}</span>
                  <span className="pct">{a.pct.toFixed(1)}%</span>
                  <span className="v">
                    ${a.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
            <div className="fx-note">
              <i className="live-dot" />
              {summary.fxUSDtoCAD
                ? `FX cached · 1 USD = ${summary.fxUSDtoCAD.toFixed(4)} CAD`
                : "FX cached during SnapTrade sync"}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <div className="panel-title">Accounts</div>
          <div className="panel-meta">
            {accounts.length} {accounts.length === 1 ? "REGISTERED" : "ACCOUNTS"}
          </div>
        </div>
        <div className="panel-body flush">
          <div className="brok-list">
            {accounts.map((a) => (
              <div className="brok-row" key={a.id}>
                <div
                  className="sym-logo"
                  style={{
                    background: a.institutionLogoBg,
                    width: 28,
                    height: 28,
                    fontSize: 10
                  }}
                >
                  {a.institutionLogoText}
                </div>
                <div>
                  <div className="nm">{a.name}</div>
                  <div className="meta">
                    {a.positionCount} positions
                  </div>
                </div>
                <span className="status reg">
                  <i className="pulse" />
                  {a.registration}
                </span>
                <span className="meta">{a.currency}</span>
                <span className="opened">opened {formatOpened(a.openedAt)}</span>
                <span className="val">${fmt2(a.totalValue)}</span>
              </div>
            ))}
          </div>
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
        <div className="ccy-toggle" role="group" aria-label="Currency display">
          <button
            type="button"
            className={!showCAD ? "on" : ""}
            onClick={() => setShowCAD(false)}
          >
            NATIVE
          </button>
          <button
            type="button"
            className={showCAD ? "on" : ""}
            onClick={() => setShowCAD(true)}
          >
            CAD
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Holdings · {sorted.length}</div>
          <div className="panel-meta">
            SORTED BY {sortKey.toUpperCase()} {sortDir.toUpperCase()}
          </div>
        </div>
        <div className="panel-body flush">
          <table className="table hold-table">
            <thead>
              <tr>
                <th
                  className={`sortable ${sortKey === "symbol" ? "active" : ""}`}
                  onClick={() => onSort("symbol")}
                  style={{ width: 200 }}
                >
                  Symbol <span className="sort-i">{sortI("symbol")}</span>
                </th>
                <th>Description</th>
                <th
                  className={`num sortable ${sortKey === "units" ? "active" : ""}`}
                  onClick={() => onSort("units")}
                  style={{ width: 80 }}
                >
                  Units <span className="sort-i">{sortI("units")}</span>
                </th>
                <th
                  className={`num sortable ${sortKey === "avgCost" ? "active" : ""}`}
                  onClick={() => onSort("avgCost")}
                  style={{ width: 90 }}
                >
                  Avg cost <span className="sort-i">{sortI("avgCost")}</span>
                </th>
                <th
                  className={`num sortable ${sortKey === "price" ? "active" : ""}`}
                  onClick={() => onSort("price")}
                  style={{ width: 90 }}
                >
                  Price <span className="sort-i">{sortI("price")}</span>
                </th>
                <th
                  className={`num sortable ${sortKey === "mvCAD" ? "active" : ""}`}
                  onClick={() => onSort("mvCAD")}
                  style={{ width: 110 }}
                >
                  Market value <span className="sort-i">{sortI("mvCAD")}</span>
                </th>
                <th
                  className={`num sortable ${sortKey === "plCAD" ? "active" : ""}`}
                  onClick={() => onSort("plCAD")}
                  style={{ width: 110 }}
                >
                  P&amp;L $ <span className="sort-i">{sortI("plCAD")}</span>
                </th>
                <th
                  className={`num sortable ${sortKey === "plPct" ? "active" : ""}`}
                  onClick={() => onSort("plPct")}
                  style={{ width: 90 }}
                >
                  P&amp;L % <span className="sort-i">{sortI("plPct")}</span>
                </th>
                <th style={{ width: 50 }}>CCY</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => {
                const plPos2 = (h.plCAD ?? 0) >= 0;
                const mv = showCAD ? h.mvCAD : h.mvNative;
                const plDollar = h.plCAD == null
                  ? null
                  : showCAD
                    ? h.plCAD
                    : h.avgCost == null
                      ? null
                      : h.mvNative - h.units * h.avgCost;
                return (
                  <tr key={h.id}>
                    <td>
                      <div className="sym-cell">
                        <SymLogo symbol={h.symbol} bg={h.logoBg} logoId={h.logoId} />
                        <span className="ticker">{h.symbol}</span>
                        <span
                          className="ccy-tag"
                          style={{
                            marginLeft: "auto",
                            fontSize: 9.5,
                            padding: "1px 4px"
                          }}
                        >
                          {h.type}
                        </span>
                      </div>
                    </td>
                    <td className="desc-cell">{h.description}</td>
                    <td className="num">
                      {h.units.toLocaleString("en-US", {
                        minimumFractionDigits: h.units % 1 ? 3 : 0,
                        maximumFractionDigits: 3
                      })}
                    </td>
                    <td className="num" style={{ color: "var(--text-3)" }}>
                      {h.avgCost == null ? "—" : h.avgCost.toFixed(2)}
                    </td>
                    <td className="num">{h.price.toFixed(2)}</td>
                    <td className="num" style={{ fontWeight: 500 }}>
                      ${fmt2(mv)}
                    </td>
                    <td className={`num ${plPos2 ? "pl-pos" : "pl-neg"}`}>
                      {plDollar == null ? "—" : `${plPos2 ? "+" : "−"}$${fmt2(Math.abs(plDollar))}`}
                    </td>
                    <td className="num">
                      {h.plPct == null ? (
                        "—"
                      ) : (
                        <span className={`pl-chip ${plPos2 ? "pos" : "neg"}`}>
                          {plPos2 ? "+" : "−"}
                          {Math.abs(h.plPct).toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="num">
                      <span className="ccy-tag">{h.currency}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div className="panel-title">Cash balances</div>
          <div className="panel-meta">{summary.cashByCcy.length} CURRENCIES</div>
        </div>
        <div className="panel-body flush">
          <table className="table">
            <thead>
              <tr>
                <th>Currency</th>
                <th className="num">Balance</th>
                <th className="num">CAD-eq.</th>
                <th className="num">Buying power</th>
              </tr>
            </thead>
            <tbody>
              {summary.cashByCcy.map((c) => (
                <tr key={c.currency}>
                  <td>
                    <span className="ccy-tag">{c.currency}</span>
                  </td>
                  <td className="num">${fmt2(c.value)}</td>
                  <td className="num" style={{ color: "var(--text-3)" }}>
                    ${fmt2(c.valueCAD)}
                  </td>
                  <td className="num">${fmt2(c.buyingPower)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="foot-note">
        <span>
          SnapTrade positions cached{" "}
          {formatRelative(summary.lastSync)}
        </span>
        <span>
          Click column headers to sort · NATIVE/CAD toggle preserves listing currency
          {summary.omittedPositionCount > 0 ? ` · ${summary.omittedPositionCount} positions omitted` : ""}
        </span>
      </div>
    </>
  );
}
