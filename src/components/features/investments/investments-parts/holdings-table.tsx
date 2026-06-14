import Link from "next/link";

import { SymLogo } from "@/components/shared/sym-logo";
import { formatMoney, formatPercent } from "@/lib/format";
import type { InvestmentPosition } from "@/lib/investments/types";

import type { SortDir, SortKey } from "./types";

export function HoldingsTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  sortI,
  showCAD,
}: {
  rows: InvestmentPosition[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  sortI: (k: SortKey) => string;
  showCAD: boolean;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Holdings · {rows.length}</div>
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
            {rows.map((h) => {
              const plPos = (h.plCAD ?? 0) >= 0;
              const mv = showCAD ? h.mvCAD : h.mvNative;
              const plDollar =
                h.plCAD == null
                  ? null
                  : showCAD
                    ? h.plCAD
                    : h.avgCost == null
                      ? null
                      : h.mvNative - h.units * h.avgCost;
              return (
                <tr key={h.id} className="tick-link">
                  <td>
                    <div className="sym-cell">
                      <SymLogo symbol={h.symbol} bg={h.logoBg} logoId={h.logoId} />
                      <Link
                        href={`/app/portfolio/${encodeURIComponent(h.symbol)}` as never}
                        className="ticker"
                        title={`Open ${h.symbol} position`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {h.symbol}
                      </Link>
                      <span
                        className="ccy-tag"
                        style={{
                          marginLeft: "auto",
                          fontSize: 9.5,
                          padding: "1px 4px",
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
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td className="num" style={{ color: "var(--text-3)" }}>
                    {h.avgCost == null ? "—" : h.avgCost.toFixed(2)}
                  </td>
                  <td className="num">{h.price.toFixed(2)}</td>
                  <td className="num" style={{ fontWeight: 500 }}>
                    {formatMoney(mv)}
                  </td>
                  <td className={`num ${plPos ? "pl-pos" : "pl-neg"}`}>
                    {plDollar == null ? "—" : formatMoney(plDollar, { sign: true })}
                  </td>
                  <td className="num">
                    {h.plPct == null ? (
                      "—"
                    ) : (
                      <span className={`pl-chip ${plPos ? "pos" : "neg"}`}>
                        {formatPercent(h.plPct)}
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
  );
}
