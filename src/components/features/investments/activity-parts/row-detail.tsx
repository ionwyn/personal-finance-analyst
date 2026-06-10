import { useState } from "react";

import type { ActivityRow } from "@/lib/investments/activities-loader";

import { dateFull } from "./format";
import { FmtAmount } from "./fmt-amount";

export function RowDetail({ row }: { row: ActivityRow }) {
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
