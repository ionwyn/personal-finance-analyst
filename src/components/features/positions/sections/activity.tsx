import { useState } from "react";

import { shortLabel } from "@/lib/investments/activity-types";
import type { PositionActivityRow, PositionDetail } from "@/lib/investments/types";

import { fmtDate, money, signMoney } from "../format";

export function Activity({ p }: { p: PositionDetail }) {
  const [filter, setFilter] = useState<"ALL" | "TRADES" | "DIV">("ALL");
  const [acct, setAcct] = useState("ALL");
  const accts = [...new Set(p.activity.map((a) => a.accountLabel))];

  const matchesFilter = (a: PositionActivityRow) =>
    filter === "ALL" ? true : filter === "TRADES" ? a.group === "trade" : a.group === "income";
  const rows = p.activity.filter(
    (a) => matchesFilter(a) && (acct === "ALL" || a.accountLabel === acct)
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="panel-title">Trades, dividends &amp; income</div>
          <div className="panel-meta">
            {rows.length} OF {p.activity.length} ROWS
          </div>
        </div>
        <div className="pos-filter-row">
          <div className="pos-seg">
            {(["ALL", "TRADES", "DIV"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? "on" : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          {accts.length > 1 ? (
            <div className="pos-seg">
              <button
                type="button"
                className={acct === "ALL" ? "on" : ""}
                onClick={() => setAcct("ALL")}
              >
                ALL
              </button>
              {accts.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={acct === a ? "on" : ""}
                  onClick={() => setAcct(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="panel-body flush">
        {rows.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-3)" }}>
            No activity synced for this holding.
          </div>
        ) : (
          <table className="table act-mini-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th style={{ width: 70 }}>Type</th>
                <th style={{ width: 76 }}>Account</th>
                <th>Description</th>
                <th className="num" style={{ width: 70 }}>
                  Units
                </th>
                <th className="num" style={{ width: 92 }}>
                  Price CAD
                </th>
                <th className="num" style={{ width: 104 }}>
                  Amount CAD
                </th>
                <th className="num" style={{ width: 70 }}>
                  FX
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const typeCls =
                  r.type === "BUY"
                    ? "buy"
                    : r.type === "SELL"
                      ? "sell"
                      : r.group === "income"
                        ? "div"
                        : "";
                const amtPos = (r.amountCad ?? 0) > 0;
                return (
                  <tr key={r.id}>
                    <td className="t-date">{fmtDate(r.tradeDate)}</td>
                    <td>
                      <span className={"act-type " + typeCls}>{shortLabel(r.type)}</span>
                    </td>
                    <td>
                      <span className="acct-reg-chip mini">{r.accountLabel}</span>
                    </td>
                    <td className="desc-cell">
                      {r.description ??
                        (r.type === "BUY" && r.units != null && r.price != null
                          ? `Bought ${Math.abs(r.units)} ${p.symbol} @ ${money(r.price)}`
                          : r.type === "SELL" && r.units != null && r.price != null
                            ? `Sold ${Math.abs(r.units)} ${p.symbol} @ ${money(r.price)}`
                            : r.group === "income"
                              ? `Cash distribution · ${p.symbol}`
                              : `${shortLabel(r.type)} · ${p.symbol}`)}
                    </td>
                    <td className="num">
                      {r.units == null
                        ? "—"
                        : r.units.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="num" style={{ color: "var(--text-3)" }}>
                      {r.price == null ? "—" : r.price.toFixed(2)}
                    </td>
                    <td className={"num " + (amtPos ? "pl-pos" : "pl-neg")}>
                      {r.amountCad == null ? "—" : signMoney(r.amountCad)}
                    </td>
                    <td className="num" style={{ color: "var(--text-4)" }}>
                      {r.fxRate == null ? "—" : r.fxRate.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
