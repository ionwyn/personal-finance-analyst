"use client";

import { InvestmentsTabs } from "@/components/features/investments/investments-tabs";
import type { MarketsOverview } from "@/lib/investments/markets-loader";

import { CurvePanel } from "./markets-parts/curve-panel";
import { MacroPanel } from "./markets-parts/macro-panel";
import { MoversPanel } from "./markets-parts/movers-panel";
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

export function MarketsView({ data }: { data: MarketsOverview }) {
  const spx = data.tape.find((t) => t.id === "spx");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Markets</div>
            <InvestmentsTabs active="markets" />
          </div>
          <div className="page-sub">
            INDICES · RATES · MACRO · AS OF {asOfLabel(data.asOf).toUpperCase()} · YAHOO FINANCE +
            FRED
          </div>
        </div>
      </div>

      <Tape tape={data.tape} />

      <div className="mkt-grid">
        <MoversPanel portfolio={data.portfolio} spx={spx} />
        <CurvePanel curve={data.curve} />
      </div>

      <MacroPanel macro={data.macro} />

      <div className="foot-note">
        <span>Quotes delayed · cached 15 min · macro series cached 12 h</span>
        <span>Market data for context only — not financial advice</span>
      </div>
    </>
  );
}
