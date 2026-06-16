"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MarketsTabs } from "@/components/features/markets/markets-tabs";
import type { InsiderTape, InsiderTapeRow } from "@/lib/investments/insider-tape-loader";

// ─── Insider tape — every open-market Form-4 across the book on one feed ────
// OpenInsider-style chronological tape: date, ticker, insider, P/S, size and
// value, plus a derived ΔOWN. Window/direction/scope filters narrow the rows
// client-side and the summary + cluster callouts re-aggregate to match, so the
// headline always describes exactly what's on screen.

const compact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
};

const signedPct = (n: number): string => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(0) + "%";

function asOfLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const WINDOWS = [30, 90, 180] as const;
type WindowDays = (typeof WINDOWS)[number];
type Direction = "all" | "buy" | "sell";
type Scope = "all" | "held";

type Cluster = {
  symbol: string;
  held: boolean;
  weight: number;
  direction: "buy" | "sell";
  people: number;
  netUsd: number;
  txCount: number;
};

function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tape-seg" role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InsiderTapeView({ data }: { data: InsiderTape }) {
  const [windowDays, setWindowDays] = useState<WindowDays>(90);
  const [direction, setDirection] = useState<Direction>("all");
  const [scope, setScope] = useState<Scope>("all");

  const cutoff = useMemo(
    () =>
      new Date(Date.parse(data.asOf) - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    [data.asOf, windowDays]
  );

  const rows = useMemo(
    () =>
      data.rows.filter((r) => {
        if (r.txDate < cutoff) return false;
        if (scope === "held" && !r.held) return false;
        if (direction === "buy" && r.txCode !== "P") return false;
        if (direction === "sell" && r.txCode !== "S") return false;
        return true;
      }),
    [data.rows, cutoff, scope, direction]
  );

  const summary = useMemo(() => {
    let boughtUsd = 0;
    let soldUsd = 0;
    let bookNetUsd = 0;
    for (const r of rows) {
      if (r.valueUsd > 0) boughtUsd += r.valueUsd;
      else soldUsd += Math.abs(r.valueUsd);
      if (r.held) bookNetUsd += r.valueUsd;
    }
    return { boughtUsd, soldUsd, bookNetUsd };
  }, [rows]);

  // Cluster = a symbol where ≥2 distinct insiders traded the same way in-window.
  const clusters = useMemo(() => {
    const bySym = new Map<string, InsiderTapeRow[]>();
    for (const r of rows) {
      const arr = bySym.get(r.symbol);
      if (arr) arr.push(r);
      else bySym.set(r.symbol, [r]);
    }
    const out: Cluster[] = [];
    for (const [symbol, txs] of bySym) {
      for (const dir of ["P", "S"] as const) {
        const leg = txs.filter((t) => t.txCode === dir);
        const people = new Set(leg.map((t) => t.person)).size;
        if (people < 2) continue;
        out.push({
          symbol,
          held: leg[0].held,
          weight: leg[0].weight,
          direction: dir === "P" ? "buy" : "sell",
          people,
          netUsd: leg.reduce((s, t) => s + t.valueUsd, 0),
          txCount: leg.length,
        });
      }
    }
    return out.sort((a, b) => Math.abs(b.netUsd) - Math.abs(a.netUsd)).slice(0, 6);
  }, [rows]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Insiders</div>
            <MarketsTabs active="insiders" />
          </div>
          <div className="page-sub">
            OPEN-MARKET FORM 4 · HELD + WATCH · AS OF {asOfLabel(data.asOf).toUpperCase()} · FINNHUB
            · THIRD-PARTY DATA — NOT ADVICE
          </div>
        </div>
      </div>

      <div className="mon-callouts">
        <div className="mon-callout">
          <span className="lbl">BOUGHT · {windowDays}D</span>
          <span className={"val mono" + (summary.boughtUsd > 0 ? " pos" : "")}>
            {summary.boughtUsd > 0 ? "$" + compact(summary.boughtUsd) : "—"}
          </span>
        </div>
        <div className="mon-callout">
          <span className="lbl">SOLD · {windowDays}D</span>
          <span className={"val mono" + (summary.soldUsd > 0 ? " neg" : "")}>
            {summary.soldUsd > 0 ? "$" + compact(summary.soldUsd) : "—"}
          </span>
        </div>
        <div className="mon-callout">
          <span className="lbl">NET · HELD · {windowDays}D</span>
          <span className={"val mono " + (summary.bookNetUsd >= 0 ? "pos" : "neg")}>
            {(summary.bookNetUsd >= 0 ? "+$" : "−$") + compact(Math.abs(summary.bookNetUsd))}
          </span>
        </div>
        <div className="mon-callout">
          <span className="lbl">COVERAGE</span>
          <span className="val mono">
            {data.coveredCount}/{data.heldCount} <em className="none">held + watch scanned</em>
          </span>
        </div>
      </div>

      {clusters.length > 0 && (
        <div className="tape-clusters">
          {clusters.map((c) => (
            <Link
              key={c.symbol + c.direction}
              href={`/app/portfolio/${encodeURIComponent(c.symbol)}` as never}
              className={"tape-cluster " + c.direction}
            >
              <span className="sym">{c.symbol}</span>
              <span className="meta">
                {c.people} {c.direction === "buy" ? "buyers" : "sellers"}
              </span>
              <span className={"net " + (c.netUsd >= 0 ? "pos" : "neg")}>
                {(c.netUsd >= 0 ? "+$" : "−$") + compact(Math.abs(c.netUsd))}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="tape-filters">
        <Seg<WindowDays>
          value={windowDays}
          onChange={setWindowDays}
          options={WINDOWS.map((w) => ({ value: w, label: `${w}D` }))}
        />
        <Seg<Direction>
          value={direction}
          onChange={setDirection}
          options={[
            { value: "all", label: "All" },
            { value: "buy", label: "Buys" },
            { value: "sell", label: "Sells" },
          ]}
        />
        <Seg<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: "all", label: "Held + watch" },
            { value: "held", label: "Held only" },
          ]}
        />
        <span className="tape-count">{rows.length} trades</span>
      </div>

      <div className="panel mon-panel">
        <div className="panel-body flush">
          <div className="tape-table">
            <div className="tape-row head">
              <span>DATE</span>
              <span>SYM</span>
              <span>INSIDER</span>
              <span className="code">P/S</span>
              <span className="num">SHARES</span>
              <span className="num">PRICE</span>
              <span className="num">VALUE</span>
              <span className="num">ΔOWN</span>
            </div>
            {rows.length === 0 ? (
              <div className="tape-empty">
                No open-market insider trades for this filter in the last {windowDays} days.
              </div>
            ) : (
              rows.map((r, i) => {
                const buy = r.txCode === "P";
                return (
                  <Link
                    key={r.symbol + r.person + r.txDate + i}
                    href={`/app/portfolio/${encodeURIComponent(r.symbol)}` as never}
                    className="tape-row"
                  >
                    <span className="date">{r.txDate.slice(2).replace(/-/g, "·")}</span>
                    <span className="sym">
                      <b>{r.symbol}</b>
                      {r.held ? (
                        <em className="wt">{r.weight.toFixed(1)}%</em>
                      ) : (
                        <em className="watch">WATCH</em>
                      )}
                    </span>
                    <span className="who" title={r.person}>
                      {r.person.toLowerCase()}
                    </span>
                    <span className={"code " + (buy ? "buy" : "sell")}>{r.txCode}</span>
                    <span className={"num shares " + (buy ? "pos" : "neg")}>
                      {(r.change >= 0 ? "+" : "−") + compact(Math.abs(r.change))}
                    </span>
                    <span className="num px">
                      {r.txPrice != null && r.txPrice > 0 ? "@" + r.txPrice.toFixed(2) : "—"}
                    </span>
                    <span className={"num usd " + (buy ? "pos" : "neg")}>
                      {(buy ? "+$" : "−$") + compact(Math.abs(r.valueUsd))}
                    </span>
                    <span className="num own">
                      {r.ownChangePct != null ? signedPct(r.ownChangePct) : "—"}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="foot-note">
        <span>
          Open-market buys (P) and sells (S) only · derivative and award transactions excluded ·
          ΔOWN = change vs pre-transaction holding · clusters flag ≥2 insiders trading the same way
        </span>
        <span>Third-party data — not financial advice</span>
      </div>
    </>
  );
}
