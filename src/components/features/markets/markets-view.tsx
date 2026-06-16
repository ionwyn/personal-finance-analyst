import { Suspense } from "react";

import { MarketsTabs } from "@/components/features/markets/markets-tabs";
import {
  getCurveBoard,
  getMacroBoardCanada,
  getMacroBoardUS,
  getTape,
} from "@/lib/investments/markets-loader";

import { CurvePanelDynamic } from "./markets-parts/curve-panel-dynamic";
import { MacroPanel } from "./markets-parts/macro-panel";
import { CurveSkeleton, MacroSkeleton, TapeSkeleton } from "./markets-parts/markets-skeletons";
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

// The header renders immediately; each data panel streams in behind its own
// <Suspense> boundary as its (independent, cache-backed) loader resolves.
export function MarketsView() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Markets</div>
            <MarketsTabs active="overview" />
          </div>
          <div className="page-sub">
            INDICES · RATES · MACRO · AS OF {asOfLabel(new Date().toISOString()).toUpperCase()} ·
            YAHOO FINANCE + FRED + STATCAN
          </div>
        </div>
      </div>

      <Suspense fallback={<TapeSkeleton />}>
        <TapeSection />
      </Suspense>

      <Suspense fallback={<CurveSkeleton />}>
        <CurveSection />
      </Suspense>

      <Suspense fallback={<MacroSkeleton />}>
        <MacroSection />
      </Suspense>

      <Suspense fallback={<MacroSkeleton />}>
        <CanadaMacroSection />
      </Suspense>

      <div className="foot-note">
        <span>Quotes delayed · cached 15 min · macro series cached 12 h</span>
        <span>Market data for context only — not financial advice</span>
      </div>
    </>
  );
}

async function TapeSection() {
  const tape = await getTape();
  return <Tape tape={tape} />;
}

async function CurveSection() {
  const curve = await getCurveBoard();
  return <CurvePanelDynamic curve={curve} />;
}

async function MacroSection() {
  const macro = await getMacroBoardUS();
  return <MacroPanel macro={macro} />;
}

async function CanadaMacroSection() {
  const canada = await getMacroBoardCanada();
  return (
    <MacroPanel
      macro={canada}
      title="Canada macro"
      meta="STATISTICS CANADA · 12H CACHE"
      order={["CA_OVERNIGHT", "CA_CPI_YOY", "CA_UNEMP", "CA_GDP_YOY"]}
    />
  );
}
