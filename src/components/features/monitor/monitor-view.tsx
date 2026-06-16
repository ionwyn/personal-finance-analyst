import Link from "next/link";

import { MarketsTabs } from "@/components/features/markets/markets-tabs";
import { WatchlistPanel } from "@/components/features/markets/markets-parts/watchlist-panel";
import type { WatchlistRow } from "@/lib/investments/markets-loader";
import type { DeskMonitor, MonitorRow } from "@/lib/investments/monitor-loader";

// ─── Desk monitor — the whole book on one intelligence sheet ────────────────
// Quote, range, next report, last surprise, rec migration and insider flow
// for every held symbol (and watch-only tickers). US single names carry the
// full row; funds and TSX listings show market columns and an em-dash where
// the free-tier sources don't reach.

const compact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
};

const signed = (n: number, digits = 1): string =>
  (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(digits);

function asOfLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function earningsCell(r: MonitorRow): { text: string; soon: boolean } | null {
  if (r.daysToEarnings == null) return null;
  if (r.daysToEarnings === 0) return { text: "TODAY", soon: true };
  return { text: `${r.daysToEarnings}D`, soon: r.daysToEarnings <= 7 };
}

function Row({ r }: { r: MonitorRow }) {
  const earn = earningsCell(r);
  const net = r.insiderNetUsd90d;
  return (
    <Link href={`/app/portfolio/${encodeURIComponent(r.symbol)}` as never} className="mon-row">
      <span className="sym">
        <b>{r.symbol}</b>
        {r.held ? <em className="wt">{r.weight.toFixed(1)}%</em> : <em className="watch">WATCH</em>}
      </span>
      <span className="num">{r.price != null ? r.price.toFixed(2) : "—"}</span>
      <span className={"num " + ((r.changePct ?? 0) >= 0 ? "pos" : "neg")}>
        {r.changePct != null ? signed(r.changePct, 2) + "%" : "—"}
      </span>
      <span className="range">
        <span className="track">
          {r.rangePos52w != null && <i style={{ left: r.rangePos52w + "%" }} />}
        </span>
      </span>
      <span className={"num earn" + (earn?.soon ? " soon" : "")}>{earn?.text ?? "—"}</span>
      <span
        className={
          "num " + (r.lastSurprisePct == null ? "" : r.lastSurprisePct >= 0 ? "pos" : "neg")
        }
      >
        {r.lastSurprisePct != null ? signed(r.lastSurprisePct) + "%" : "—"}
      </span>
      <span className="num beats">
        {r.beats != null && r.beatTotal != null ? `${r.beats}/${r.beatTotal}` : "—"}
      </span>
      <span className="num recs">
        {r.recBuys != null && r.recTotal != null ? (
          <>
            {r.recBuys}/{r.recTotal}
            {r.recDelta3m != null && r.recDelta3m !== 0 && (
              <em className={r.recDelta3m > 0 ? "pos" : "neg"}>
                {r.recDelta3m > 0 ? "▲" : "▼"}
                {Math.abs(r.recDelta3m)}
              </em>
            )}
          </>
        ) : (
          "—"
        )}
      </span>
      <span
        className={"num " + (net == null ? "" : net >= 0 ? "pos" : "neg")}
        title={
          r.usCovered
            ? `${r.insiderBuys90d} buys · ${r.insiderSells90d} sells (90d, open market)`
            : undefined
        }
      >
        {net != null ? (net >= 0 ? "+$" : "−$") + compact(Math.abs(net)) : "—"}
      </span>
    </Link>
  );
}

export function MonitorView({
  data,
  watchlist,
  canEdit,
}: {
  data: DeskMonitor;
  watchlist: WatchlistRow[];
  canEdit: boolean;
}) {
  const held = data.rows.filter((r) => r.held);
  const watched = data.rows.filter((r) => !r.held);
  const covered = held.filter((r) => r.usCovered).length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Watch &amp; Intel</div>
            <MarketsTabs active="intel" />
          </div>
          <div className="page-sub">
            POSITION INTELLIGENCE · AS OF {asOfLabel(data.asOf).toUpperCase()} · FINNHUB + YAHOO ·
            THIRD-PARTY DATA — NOT ADVICE
          </div>
        </div>
      </div>

      <WatchlistPanel rows={watchlist} canEdit={canEdit} />

      <div className="mon-callouts">
        <div className="mon-callout">
          <span className="lbl">REPORTING ≤ 14D</span>
          <span className="val">
            {data.reportingSoon.length > 0 ? (
              data.reportingSoon.slice(0, 4).map((e) => (
                <em key={e.symbol}>
                  {e.symbol} <b>{e.days === 0 ? "today" : e.days + "d"}</b>
                </em>
              ))
            ) : (
              <em className="none">none scheduled</em>
            )}
          </span>
        </div>
        <div className="mon-callout">
          <span className="lbl">INSIDER FLOW · BOOK · 90D</span>
          <span className={"val mono " + (data.bookInsiderNetUsd >= 0 ? "pos" : "neg")}>
            {(data.bookInsiderNetUsd >= 0 ? "+$" : "−$") +
              compact(Math.abs(data.bookInsiderNetUsd))}
          </span>
        </div>
        <div className="mon-callout">
          <span className="lbl">BIGGEST REC SHIFT · 3M</span>
          <span className="val mono">
            {data.topRecShift ? (
              <>
                {data.topRecShift.symbol}{" "}
                <b className={data.topRecShift.delta > 0 ? "pos" : "neg"}>
                  {signed(data.topRecShift.delta, 0)} buys
                </b>
              </>
            ) : (
              <em className="none">no migration</em>
            )}
          </span>
        </div>
        <div className="mon-callout">
          <span className="lbl">INTEL COVERAGE</span>
          <span className="val mono">
            {covered}/{held.length} <em className="none">held names</em>
          </span>
        </div>
      </div>

      <div className="panel mon-panel">
        <div className="panel-head">
          <div className="panel-title">Held positions</div>
          <div className="panel-meta">
            LAST · DAY · 52W · NEXT EPS · SURPRISE · BEATS · BUY RECS · INSIDER 90D
          </div>
        </div>
        <div className="panel-body flush">
          <div className="mon-table">
            <div className="mon-row head">
              <span>SYM</span>
              <span className="num">LAST</span>
              <span className="num">DAY</span>
              <span className="range">52W RANGE</span>
              <span className="num">NEXT EPS</span>
              <span className="num">SURP</span>
              <span className="num">BEATS</span>
              <span className="num">RECS</span>
              <span className="num">INSIDERS</span>
            </div>
            {held.map((r) => (
              <Row key={r.symbol} r={r} />
            ))}
          </div>
        </div>
      </div>

      {watched.length > 0 && (
        <div className="panel mon-panel">
          <div className="panel-head">
            <div className="panel-title">Watch-only</div>
            <div className="panel-meta">ON WATCHLIST · NOT HELD</div>
          </div>
          <div className="panel-body flush">
            <div className="mon-table">
              {watched.map((r) => (
                <Row key={r.symbol} r={r} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="foot-note">
        <span>
          Surprise = last reported EPS vs street estimate · Recs = buy-rated / total analysts ·
          Insiders = net open-market $ flow, 90 days
        </span>
        <span>Third-party data — not financial advice</span>
      </div>
    </>
  );
}
