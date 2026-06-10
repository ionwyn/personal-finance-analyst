import { formatRelativeTime } from "@/lib/format";
import type { PositionDetail } from "@/lib/investments/types";

import { AiInsightsDeferred } from "../position-deferred";

function FreshRow({
  lbl,
  v,
  live,
  stale,
}: {
  lbl: string;
  v: string;
  live?: boolean;
  stale?: boolean;
}) {
  return (
    <div className="pos-fresh-row">
      <span className={"dot " + (live ? "live" : stale ? "stale" : "")} />
      <span className="lbl">{lbl}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function Rail({ p }: { p: PositionDetail }) {
  const isUsd = p.currency.toUpperCase() === "USD";
  return (
    <aside className="pos-rail">
      <AiInsightsDeferred symbol={p.symbol} />
      <div className="rail-card">
        <div className="rail-head">
          <div className="rail-title">DATA FRESHNESS</div>
          <span className="rail-meta">FROM SYNC</span>
        </div>
        <div className="pos-fresh">
          <FreshRow
            lbl="Positions"
            v={p.lastSync ? formatRelativeTime(p.lastSync) : "—"}
            live={p.syncIsFresh}
          />
          <FreshRow lbl="Price" v="At last sync" stale />
          <FreshRow lbl="Fundamentals" v="Not active" stale />
          <FreshRow lbl="News" v="Not active" stale />
          <FreshRow lbl="FX (USD/CAD)" v={isUsd ? "From sync" : "n/a"} />
        </div>
        <div className="pos-fresh-foot">
          <span>SOURCE · SnapTrade brokerage sync</span>
        </div>
      </div>
    </aside>
  );
}
