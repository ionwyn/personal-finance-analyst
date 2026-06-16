"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";

import { FundamentalsLive, NewsList } from "@/components/features/positions/position-market";
import {
  PriceChartDynamic,
  TechnicalsPanelDynamic,
} from "@/components/features/positions/position-market-dynamic";
import {
  EarningsPanel,
  FilingsPanel,
  FinancialsPanel,
  hasIntel,
  InsiderPanel,
  PeersPanel,
  RecMomentumPanel,
} from "@/components/features/positions/position-intel";
import { AnalystPanel, DividendsPanel } from "@/components/features/positions/position-street";
import { Section } from "@/components/features/positions/sections/section";
import { requestApi } from "@/lib/client-api";
import type { SymbolDetail } from "@/lib/investments/symbol-loader";

// ─── Market-only symbol page — research view for tickers you don't hold ────

const money = (n: number, dp = 2) =>
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

function big(n: number): string {
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(0) + "M";
  return "$" + Math.round(n).toLocaleString();
}

function WatchToggle({
  symbol,
  name,
  onWatchlist,
  canEdit,
}: {
  symbol: string;
  name: string | null;
  onWatchlist: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canEdit) return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (onWatchlist) {
        await requestApi(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" });
      } else {
        await requestApi("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, name }),
        });
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update watchlist");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="sym-watch-btn" onClick={toggle} disabled={busy}>
        {onWatchlist ? <EyeOff size={11} /> : <Eye size={11} />}
        {onWatchlist ? "UNWATCH" : "WATCH"}
      </button>
      {error && (
        <span className="inline-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

export function SymbolView({ data, canEdit }: { data: SymbolDetail; canEdit: boolean }) {
  const md = data.marketData;
  const q = md.quote!;
  const f = md.fundamentals;
  const profile = md.profile;
  const dayDir = q.changePct >= 0 ? "pos" : "neg";

  const rangePos =
    q.high52w != null && q.low52w != null && q.high52w !== q.low52w
      ? ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100
      : null;

  return (
    <div className="pos-page">
      <div className="pos-hero">
        <div className="pos-hero-row">
          <div className="pos-hero-id">
            <Link href={"/app/markets/intel" as never} className="pos-back">
              <ChevronLeft size={11} />
              Back to Watch &amp; Intel
            </Link>
            <div className="pos-id-row">
              <div className="pos-logo" style={{ background: "var(--surface-3)" }}>
                {data.symbol.replace(/\..*$/, "").slice(0, 4)}
              </div>
              <div className="pos-symbol">{data.symbol}</div>
              <div className="pos-name">{data.name ?? ""}</div>
              <div className="pos-chips">
                <span className="pos-chip">{data.isFund ? "FUND" : "EQUITY"}</span>
                <span className="pos-chip">{data.currency}</span>
                <span className="pos-chip ghost">NOT HELD</span>
              </div>
            </div>
          </div>
          <div className="pos-hero-px">
            <div className="pos-px-large">
              <span className="ccy">$</span>
              {q.price.toFixed(2)}
              <span className="px-ccy">{data.currency}</span>
            </div>
            <div className="pos-day-row">
              <span className={"sym-day " + dayDir}>
                {(q.changePct >= 0 ? "+" : "−") + Math.abs(q.change).toFixed(2)} (
                {(q.changePct >= 0 ? "+" : "−") + Math.abs(q.changePct).toFixed(2)}%) today
              </span>
              <WatchToggle
                symbol={data.symbol}
                name={data.name}
                onWatchlist={data.onWatchlist}
                canEdit={canEdit}
              />
            </div>
          </div>
        </div>

        <div className="pos-stat-row">
          <div className="pos-stat">
            <div className="pos-stat-lbl">Day range</div>
            <div className="pos-stat-val">
              {q.dayLow != null && q.dayHigh != null
                ? `${money(q.dayLow)} – ${money(q.dayHigh)}`
                : "—"}
            </div>
            <div className="pos-stat-sub">open {q.open != null ? money(q.open) : "—"}</div>
          </div>
          <div className="pos-stat">
            <div className="pos-stat-lbl">52-week range</div>
            <div className="pos-stat-val">
              {q.low52w != null && q.high52w != null
                ? `${money(q.low52w, 0)} – ${money(q.high52w, 0)}`
                : "—"}
            </div>
            <div className="pos-stat-sub">
              {rangePos != null ? `at ${rangePos.toFixed(0)}% of range` : "—"}
            </div>
          </div>
          <div className="pos-stat">
            <div className="pos-stat-lbl">Volume</div>
            <div className="pos-stat-val">
              {q.volume != null ? q.volume.toLocaleString("en-US") : "—"}
            </div>
            <div className="pos-stat-sub">
              {q.avgVolume != null ? `avg ${q.avgVolume.toLocaleString("en-US")}` : "3M avg n/a"}
            </div>
          </div>
          <div className="pos-stat">
            <div className="pos-stat-lbl">{data.isFund ? "Net assets" : "Market cap"}</div>
            <div className="pos-stat-val">
              {data.isFund
                ? f?.aum != null
                  ? big(f.aum)
                  : "—"
                : q.marketCap != null
                  ? big(q.marketCap)
                  : "—"}
            </div>
            <div className="pos-stat-sub">{data.currency}</div>
          </div>
          <div className="pos-stat">
            <div className="pos-stat-lbl">Dividend yield</div>
            <div className="pos-stat-val">
              {f?.dividendYieldPct != null ? f.dividendYieldPct.toFixed(2) + "%" : "—"}
            </div>
            <div className="pos-stat-sub">trailing</div>
          </div>
          <div className="pos-stat">
            <div className="pos-stat-lbl">Sector</div>
            <div className="pos-stat-val sym-sector">{profile?.sector ?? "—"}</div>
            <div className="pos-stat-sub">{profile?.industry ?? ""}</div>
          </div>
        </div>
      </div>

      <div className="pos-grid sym-grid">
        <div className="pos-main">
          <Section
            id="overview"
            eyebrow="01 · PRICE"
            title="Market price"
            meta={`${md.series.length} trading days of history`}
          >
            <div className="panel">
              <div className="panel-body" style={{ padding: "8px 4px 8px" }}>
                <PriceChartDynamic md={md} avgNative={null} />
              </div>
            </div>
          </Section>

          <Section
            id="fundamentals"
            eyebrow="02 · FUNDAMENTALS"
            title={data.isFund ? "Fund profile & costs" : "Business & valuation"}
          >
            <div className="pos-stack">
              <FundamentalsLive md={md} isFund={data.isFund} />
              {data.intel && <FinancialsPanel financials={data.intel.financials} />}
              <AnalystPanel md={md} />
              <DividendsPanel md={md} currency={data.currency} />
            </div>
          </Section>

          {data.intel && hasIntel(data.intel) && (
            <Section
              id="intel"
              eyebrow="03 · STREET INTELLIGENCE"
              title="Earnings, analysts, insiders & filings"
              meta="third-party data — not advice"
            >
              <div className="pos-stack">
                <EarningsPanel earnings={data.intel.earnings} />
                <RecMomentumPanel recTrends={data.intel.recTrends} />
                <InsiderPanel insiders={data.intel.insiders} />
                <PeersPanel peerRows={data.intel.peerRows} />
                <FilingsPanel filings={data.intel.filings} />
              </div>
            </Section>
          )}

          <Section
            id="technicals"
            eyebrow="04 · TECHNICALS"
            title="Optional context"
            meta="secondary for long-hold investors"
          >
            <TechnicalsPanelDynamic md={md} />
          </Section>

          <Section id="news" eyebrow="05 · NEWS & EVENTS" title="Curated, relevance-weighted">
            <NewsList md={md} symbol={data.symbol} name={data.name} />
          </Section>

          {profile?.description ? (
            <Section id="about" eyebrow="06 · ABOUT" title={data.name ?? data.symbol}>
              <div className="panel">
                <div className="panel-body">
                  <p className="sym-desc">{profile.description}</p>
                </div>
              </div>
            </Section>
          ) : null}

          <div className="foot-note" style={{ marginTop: 24 }}>
            <span>Research view — you hold no position in this security.</span>
            <span>Not financial advice</span>
          </div>
        </div>
      </div>
    </div>
  );
}
