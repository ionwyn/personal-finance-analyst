import { SymLogo } from "@/components/shared/sym-logo";
import type { ActivityRow } from "@/lib/investments/activities-loader";

import { AcctBadge } from "./acct-badge";
import { EmptyFilterRow } from "./banners";
import { FmtAmount } from "./fmt-amount";
import { dateDay, dateMonth } from "./format";
import { RowDetail } from "./row-detail";
import { TypeChip } from "./type-chip";

export function MobileActivityList({
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
