"use client";

import { useEffect, useState } from "react";

import type { PositionDetail } from "@/lib/investments/types";

import { SECTIONS } from "./format";
import {
  DecisionDeferred,
  FundamentalsDeferred,
  NewsDeferred,
  PriceChartDeferred,
  TechnicalsDeferred,
} from "./position-deferred";
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
        <Nav active={active} onJump={jump} />
      </div>
      <div className="pos-grid">
        <div className="pos-main">
          <Section
            id="overview"
            eyebrow="01 · OVERVIEW"
            title="Price, my cost basis & trades"
            meta="market chart activates once a price feed is connected"
          >
            <div className="panel">
              <div className="panel-body" style={{ padding: "8px 4px 8px" }}>
                <PriceChartDeferred p={p} />
              </div>
            </div>
          </Section>

          <Section
            id="performance"
            eyebrow="02 · PERSONAL PERFORMANCE"
            title="How this position has performed for me"
            meta="all amounts CAD · open + dividends − fees"
          >
            <Performance p={p} />
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
            <FundamentalsDeferred p={p} />
          </Section>

          <Section
            id="technicals"
            eyebrow="07 · TECHNICALS"
            title="Optional context"
            meta="secondary for long-hold investors"
          >
            <TechnicalsDeferred />
          </Section>

          <Section id="news" eyebrow="08 · NEWS & EVENTS" title="Curated, relevance-weighted">
            <NewsDeferred p={p} />
          </Section>

          <Section
            id="decision"
            eyebrow="09 · DECISION SUPPORT"
            title="Cases & scenarios"
            meta="analysis — not financial advice"
          >
            <DecisionDeferred p={p} />
          </Section>

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
