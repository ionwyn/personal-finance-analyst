"use client";

import { MarketsTabs } from "@/components/features/markets/markets-tabs";
import type { MacroBoard } from "@/lib/investments/markets-loader";

import { CurvePanel } from "./markets-parts/curve-panel";
import { MacroPanel } from "./markets-parts/macro-panel";
import { Tape } from "./markets-parts/tape";

function asOfLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MarketsView({ data }: { data: MacroBoard }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Markets</div>
            <MarketsTabs active="overview" />
          </div>
          <div className="page-sub">
            INDICES · RATES · MACRO · AS OF {asOfLabel(data.asOf).toUpperCase()} · YAHOO FINANCE +
            FRED + STATCAN
          </div>
        </div>
      </div>

      <Tape tape={data.tape} />

      <CurvePanel curve={data.curve} />

      <MacroPanel macro={data.macro} />

      <MacroPanel
        macro={data.canada}
        title="Canada macro"
        meta="STATISTICS CANADA · 12H CACHE"
        order={["CA_OVERNIGHT", "CA_CPI_YOY", "CA_UNEMP", "CA_GDP_YOY"]}
      />

      <div className="foot-note">
        <span>Quotes delayed · cached 15 min · macro series cached 12 h</span>
        <span>Market data for context only — not financial advice</span>
      </div>
    </>
  );
}
