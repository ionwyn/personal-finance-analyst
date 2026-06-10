import type { PositionDetail } from "@/lib/investments/types";

import { money, pct, signMoney } from "../format";
import { ReturnPeriodsDeferred } from "../position-deferred";

export function Performance({ p }: { p: PositionDetail }) {
  const perf = p.performance;
  const cells = [
    {
      lbl: "Open P&L",
      v: perf.openPlCad,
      sub: perf.openPlPct == null ? "cost basis n/a" : pct(perf.openPlPct) + " on cost",
      note: `mkt ${money(p.mvCad)}${p.costCad == null ? "" : " · cost " + money(p.costCad)}`,
      tone: (perf.openPlCad ?? 0) >= 0 ? "pos" : "neg",
    },
    {
      lbl: "Realized P&L",
      v: perf.realizedCad,
      sub: "no sales matched",
      note: "lot matching not yet modelled",
      tone: "neutral",
    },
    {
      lbl: "Dividends",
      v: perf.dividendsCad,
      sub: perf.dividendsCad > 0 ? "received · CAD" : "none recorded",
      note: perf.dividendCount > 0 ? `${perf.dividendCount} payments` : "no distributions synced",
      tone: "neutral",
    },
    {
      lbl: "Fees & FX drag",
      v: -perf.feesCad,
      sub: "commissions + fees",
      note: perf.feesCad > 0 ? "from synced activity" : "none recorded",
      tone: "neg",
    },
    {
      lbl: "Total return",
      v: perf.totalReturnCad,
      sub: perf.totalReturnPct == null ? "open + dividends" : pct(perf.totalReturnPct) + " all-in",
      note: "open + dividends − fees",
      tone: (perf.totalReturnCad ?? 0) >= 0 ? "pos" : "neg",
      strong: true,
    },
  ];
  return (
    <div className="pos-perf-grid">
      <div className="pos-perf-cells">
        {cells.map((c, i) => (
          <div key={i} className={"pos-perf-cell " + (c.strong ? "strong " : "") + c.tone}>
            <div className="lbl">{c.lbl}</div>
            <div className="val">{c.v == null ? "—" : signMoney(c.v)}</div>
            <div className="sub">{c.sub}</div>
            <div className="note">{c.note}</div>
          </div>
        ))}
      </div>
      <ReturnPeriodsDeferred />
    </div>
  );
}
