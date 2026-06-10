import { Fragment } from "react";

import { SymLogo } from "@/components/shared/sym-logo";
import type { ActivityRow } from "@/lib/investments/activities-loader";

import { AcctBadge } from "./acct-badge";
import { EmptyFilterRow } from "./banners";
import { FmtAmount } from "./fmt-amount";
import { dateDay, dateMonth } from "./format";
import { RowDetail } from "./row-detail";
import { TypeChip } from "./type-chip";

type SortKey = "date" | "amount" | "fees";

export function ActivityTable({
  rows,
  sortKey,
  onSort,
  sortI,
  expandedId,
  onExpand,
}: {
  rows: ActivityRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  sortI: (k: SortKey) => string;
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
