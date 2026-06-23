"use client";

import { useEffect, useState } from "react";

import type { PositionDetail } from "@/lib/investments/types";
import { isLikelyUsListed } from "@/lib/valafi/symbols";

import { SECTIONS } from "./format";
import { PositionSupplyChain } from "./position-supply-chain";
import { DecisionDeferred, FundamentalsLive, NewsList } from "./position-market";
import { PriceChartDynamic, TechnicalsPanelDynamic } from "./position-market-dynamic";
import {
  EarningsPanel,
  FilingsPanel,
  FinancialsPanel,
  hasIntel,
  InsiderPanel,
  PeersPanel,
  RecMomentumPanel,
} from "./position-intel";
import { AnalystPanel, DividendsPanel } from "./position-street";
import { Activity } from "./sections/activity";
import { Exposure } from "./sections/exposure";
import { Hero } from "./sections/hero";
import { Nav } from "./sections/nav";
import { Ownership } from "./sections/ownership";
import { Performance } from "./sections/performance";
import { Rail } from "./sections/rail";
import { Section } from "./sections/section";

export function PositionView({ data: p }: { data: PositionDetail }) {
  const [active, setActive] = useState("overview");
  const showIntel = p.intel != null && hasIntel(p.intel);
  const showSupplyChain = isLikelyUsListed(p.symbol) && !p.isFund;

  const navExclude = [
    ...(showIntel ? [] : ["intel"]),
    ...(showSupplyChain ? [] : ["supply-chain"]),
  ];

  const jump = (id: string) => {
    setActive(id);
    const el = document.getElementById("pos-sec-" + id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const ids = SECTIONS.map(([k]) => k);
    const onScroll = () => {
      for (const id of ids) {
        const el = document.getElementById("pos-sec-" + id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top > 60 && top < 340) {
          setActive(id);
          return;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.scrollTo({ top: 0 });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pos-page">
      <Hero p={p} />
      <div className="pos-nav-wrap">
        <Nav active={active} onJump={jump} exclude={navExclude.length ? navExclude : undefined} />
      </div>
      <div className="pos-grid">
        <div className="pos-main">
          <Section
            id="overview"
            eyebrow="01 · OVERVIEW"
            title="Price, my cost basis & trades"
            meta={
              p.marketData?.series.length
                ? `${p.marketData.series.length} trading days of history`
                : "market chart activates once a price feed is connected"
            }
          >
            <div className="panel">
              <div className="panel-body" style={{ padding: "8px 4px 8px" }}>
                <PriceChartDynamic
                  md={p.marketData}
                  avgNative={p.avgNative}
                  activity={p.activity}
                />
              </div>
            </div>
          </Section>

          <Section
            id="performance"
            eyebrow="02 · PERSONAL PERFORMANCE"
            title="How this position has performed for me"
            meta="all amounts CAD · open + dividends − fees"
          >
            <Performance p={p} periods={p.marketData?.periods ?? null} />
          </Section>

          <Section
            id="ownership"
            eyebrow="03 · OWNERSHIP"
            title="Where I hold this position"
            meta={`${p.lots.length} ${p.lots.length > 1 ? "lots" : "lot"} across ${
              new Set(p.lots.map((l) => l.institution)).size
            } institution${new Set(p.lots.map((l) => l.institution)).size > 1 ? "s" : ""}`}
          >
            <Ownership p={p} />
          </Section>

          <Section
            id="activity"
            eyebrow="04 · ACTIVITY"
            title="Trades, dividends & income"
            meta="filter by type or account"
          >
            <Activity p={p} />
          </Section>

          <Section
            id="exposure"
            eyebrow="05 · EXPOSURE"
            title="Contribution to portfolio & classification"
          >
            <Exposure p={p} />
          </Section>

          <Section
            id="fundamentals"
            eyebrow="06 · FUNDAMENTALS"
            title={p.isFund ? "Fund profile & costs" : "Business & valuation"}
          >
            <div className="pos-stack">
              <FundamentalsLive md={p.marketData} isFund={p.isFund} />
              {p.intel && <FinancialsPanel financials={p.intel.financials} />}
              <AnalystPanel md={p.marketData} />
              <DividendsPanel md={p.marketData} currency={p.currency} units={p.totalUnits} />
            </div>
          </Section>

          {showIntel && p.intel && (
            <Section
              id="intel"
              eyebrow="07 · STREET INTELLIGENCE"
              title="Earnings, analysts, insiders & filings"
              meta="third-party data — not advice"
            >
              <div className="pos-stack">
                <EarningsPanel earnings={p.intel.earnings} />
                <RecMomentumPanel recTrends={p.intel.recTrends} />
                <InsiderPanel insiders={p.intel.insiders} />
                <PeersPanel peerRows={p.intel.peerRows} />
                <FilingsPanel filings={p.intel.filings} />
              </div>
            </Section>
          )}

          <Section
            id="technicals"
            eyebrow="08 · TECHNICALS"
            title="Optional context"
            meta="secondary for long-hold investors"
          >
            <TechnicalsPanelDynamic md={p.marketData} />
          </Section>

          <Section id="news" eyebrow="09 · NEWS & EVENTS" title="Curated, relevance-weighted">
            <NewsList md={p.marketData} symbol={p.symbol} name={p.name} />
          </Section>

          <Section
            id="decision"
            eyebrow="10 · DECISION SUPPORT"
            title="Cases & scenarios"
            meta="analysis — not financial advice"
          >
            <DecisionDeferred p={p} />
          </Section>

          {showSupplyChain && (
            <Section
              id="supply-chain"
              eyebrow="11 · SUPPLY CHAIN"
              title="Suppliers, customers & competitors"
              meta="Vala-Fi · extracted from SEC filings"
            >
              <PositionSupplyChain symbol={p.symbol} name={p.name} />
            </Section>
          )}

          <div className="foot-note" style={{ marginTop: 24 }}>
            <span>Personal-ownership view. Figures reflect your last brokerage sync.</span>
            <span>Not financial advice</span>
          </div>
        </div>
        <Rail p={p} />
      </div>
    </div>
  );
}
