"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { formatRelativeTime } from "@/lib/format";
import { shortLabel } from "@/lib/investments/activity-types";
import type { PositionActivityRow, PositionDetail } from "@/lib/investments/types";

import {
  AiInsightsDeferred,
  DecisionDeferred,
  FundamentalsDeferred,
  NewsDeferred,
  PriceChartDeferred,
  ReturnPeriodsDeferred,
  TechnicalsDeferred,
} from "./position-deferred";

// ─── tiny formatters (mirror the prototype's local helpers) ────────────────
const money = (n: number, dp = 2) =>
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const signMoney = (n: number, dp = 2) => (n >= 0 ? "+" : "−") + money(n, dp);
const pct = (n: number, dp = 2) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(dp) + "%";
const dash = (v: string | null | undefined) => (v == null ? "—" : v);

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

const SECTIONS: [string, string][] = [
  ["overview", "Overview"],
  ["performance", "Performance"],
  ["ownership", "Ownership"],
  ["activity", "Activity"],
  ["exposure", "Exposure"],
  ["fundamentals", "Fundamentals"],
  ["technicals", "Technicals"],
  ["news", "News"],
  ["decision", "Cases"],
];

// ─── shell ─────────────────────────────────────────────────────────────────
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

// ─── hero ────────────────────────────────────────────────────────────────
function Hero({ p }: { p: PositionDetail }) {
  const uplPos = (p.uplCad ?? 0) >= 0;
  const trPos = (p.performance.totalReturnCad ?? 0) >= 0;
  const isUsd = p.currency.toUpperCase() === "USD";
  return (
    <div className="pos-hero">
      <div className="pos-hero-row">
        <div className="pos-hero-id">
          <Link href={"/app/investments" as never} className="pos-back">
            <ChevronLeft size={11} />
            Back to Investments
          </Link>
          <div className="pos-id-row">
            <div
              className="pos-logo"
              style={{
                background: p.logoBg,
                backgroundImage: p.logoId ? `url(/api/snaptrade/logos/${p.logoId})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {p.logoId ? null : p.symbol.replace(/\..*$/, "").slice(0, 4)}
            </div>
            <div className="pos-symbol">{p.symbol}</div>
            <div className="pos-name">{p.name}</div>
            <div className="pos-chips">
              <span className="pos-chip">{p.type.toUpperCase()}</span>
              {p.exchange ? <span className="pos-chip">{p.exchange}</span> : null}
              <span className="pos-chip">{p.currency}</span>
            </div>
          </div>
        </div>
        <div className="pos-hero-px">
          <div className="pos-px-large">
            <span className="ccy">$</span>
            {p.price.toFixed(2)}
            <span className="px-ccy">{p.currency}</span>
          </div>
          <div className="pos-day-row">
            <span className="pos-day-meta">LAST SYNCED PRICE · LIVE QUOTES NOT ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="pos-stat-row">
        <Stat
          label="My quantity"
          value={p.totalUnits.toLocaleString("en-US", { maximumFractionDigits: 3 })}
          sub={`across ${p.lots.length} ${p.lots.length > 1 ? "accounts" : "account"}`}
        />
        <Stat
          label="Market value · CAD"
          value={money(p.mvCad)}
          sub={
            isUsd && p.fxUSDtoCAD
              ? `${money(p.mvNative)} ${p.currency} · FX ${p.fxUSDtoCAD.toFixed(4)}`
              : `${p.totalUnits.toLocaleString("en-US", { maximumFractionDigits: 1 })} units · native CAD`
          }
          accent
        />
        <Stat
          label={`Avg cost · ${p.currency}`}
          value={p.avgNative == null ? "—" : money(p.avgNative)}
          sub={p.costCad == null ? "cost basis n/a" : `book ${money(p.costCad)} CAD`}
        />
        <Stat
          label="Unrealized P&L"
          value={p.uplCad == null ? "—" : signMoney(p.uplCad)}
          sub={p.uplPct == null ? "cost basis n/a" : `${pct(p.uplPct)} on cost`}
          tone={p.uplCad == null ? undefined : uplPos ? "pos" : "neg"}
        />
        <Stat
          label="Total return"
          value={
            p.performance.totalReturnCad == null ? "—" : signMoney(p.performance.totalReturnCad)
          }
          sub={
            p.performance.totalReturnPct == null
              ? "open + dividends"
              : `open + dividends · ${pct(p.performance.totalReturnPct)}`
          }
          tone={p.performance.totalReturnCad == null ? undefined : trPos ? "pos" : "neg"}
        />
        <Stat
          label="Portfolio weight"
          value={p.weight.toFixed(2) + "%"}
          sub={`rank #${p.exposure.rank} of ${p.exposure.count}`}
          weight={p.weight}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  accent,
  weight,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "pos" | "neg";
  accent?: boolean;
  weight?: number;
}) {
  return (
    <div className={"pos-stat" + (accent ? " accent" : "")}>
      <div className="pos-stat-lbl">{label}</div>
      <div className={"pos-stat-val " + (tone ?? "")}>{value}</div>
      <div className="pos-stat-sub">{sub}</div>
      {weight != null ? (
        <div className="pos-weight-track">
          <i style={{ width: Math.min(weight * 4, 100) + "%" }} />
        </div>
      ) : null}
    </div>
  );
}

function Nav({ active, onJump }: { active: string; onJump: (id: string) => void }) {
  return (
    <div className="pos-nav">
      {SECTIONS.map(([k, l]) => (
        <button
          key={k}
          type="button"
          className={"pos-nav-btn " + (active === k ? "on" : "")}
          onClick={() => onJump(k)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  meta,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pos-section" id={"pos-sec-" + id}>
      <div className="pos-section-head">
        <div>
          <div className="pos-eyebrow">{eyebrow}</div>
          <div className="pos-section-title">{title}</div>
          {meta ? <div className="pos-section-meta">{meta}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── performance ───────────────────────────────────────────────────────────
function Performance({ p }: { p: PositionDetail }) {
  const perf = p.performance;
  const cells = [
    {
      lbl: "Open P&L",
      v: perf.openPlCad,
      sub: perf.openPlPct == null ? "cost basis n/a" : pct(perf.openPlPct) + " on cost",
      note: `mkt ${money(p.mvCad)}${p.costCad == null ? "" : " · cost " + money(p.costCad)}`,
      tone: (perf.openPlCad ?? 0) >= 0 ? "pos" : "neg",
    },
    {
      lbl: "Realized P&L",
      v: perf.realizedCad,
      sub: "no sales matched",
      note: "lot matching not yet modelled",
      tone: "neutral",
    },
    {
      lbl: "Dividends",
      v: perf.dividendsCad,
      sub: perf.dividendsCad > 0 ? "received · CAD" : "none recorded",
      note: perf.dividendCount > 0 ? `${perf.dividendCount} payments` : "no distributions synced",
      tone: "neutral",
    },
    {
      lbl: "Fees & FX drag",
      v: -perf.feesCad,
      sub: "commissions + fees",
      note: perf.feesCad > 0 ? "from synced activity" : "none recorded",
      tone: "neg",
    },
    {
      lbl: "Total return",
      v: perf.totalReturnCad,
      sub: perf.totalReturnPct == null ? "open + dividends" : pct(perf.totalReturnPct) + " all-in",
      note: "open + dividends − fees",
      tone: (perf.totalReturnCad ?? 0) >= 0 ? "pos" : "neg",
      strong: true,
    },
  ];
  return (
    <div className="pos-perf-grid">
      <div className="pos-perf-cells">
        {cells.map((c, i) => (
          <div key={i} className={"pos-perf-cell " + (c.strong ? "strong " : "") + c.tone}>
            <div className="lbl">{c.lbl}</div>
            <div className="val">{c.v == null ? "—" : signMoney(c.v)}</div>
            <div className="sub">{c.sub}</div>
            <div className="note">{c.note}</div>
          </div>
        ))}
      </div>
      <ReturnPeriodsDeferred />
    </div>
  );
}

// ─── ownership ───────────────────────────────────────────────────────────
function Ownership({ p }: { p: PositionDetail }) {
  const yrs = p.holdLabel ?? "—";
  const upPos = (p.uplCad ?? 0) >= 0;
  return (
    <div className="panel">
      <div className="panel-body flush">
        <table className="table own-table">
          <thead>
            <tr>
              <th style={{ width: 230 }}>Account</th>
              <th className="num" style={{ width: 80 }}>
                Units
              </th>
              <th className="num" style={{ width: 92 }}>
                Avg cost
              </th>
              <th className="num" style={{ width: 96 }}>
                Cost CAD
              </th>
              <th className="num" style={{ width: 104 }}>
                Market CAD
              </th>
              <th className="num" style={{ width: 124 }}>
                Unreal. P&amp;L
              </th>
              <th className="num" style={{ width: 96 }}>
                % of position
              </th>
              <th style={{ width: 96 }}>Held since</th>
            </tr>
          </thead>
          <tbody>
            {p.lots.map((l, i) => {
              const pos = (l.uplCad ?? 0) >= 0;
              return (
                <tr key={i}>
                  <td>
                    <div className="own-acct">
                      <i className="own-logo" style={{ background: l.institutionLogoBg }}>
                        {l.institutionLogoText}
                      </i>
                      <div>
                        <div className="own-acct-nm">
                          {l.institution} · {l.accountLabel}
                        </div>
                        <div className="own-acct-sub">{l.currency} · Self-directed</div>
                      </div>
                      <span className="acct-reg-chip">{l.accountLabel}</span>
                    </div>
                  </td>
                  <td className="num">
                    {l.units.toLocaleString("en-US", { maximumFractionDigits: 3 })}
                  </td>
                  <td className="num" style={{ color: "var(--text-3)" }}>
                    {l.avg == null ? "—" : money(l.avg)}
                  </td>
                  <td className="num" style={{ color: "var(--text-3)" }}>
                    {l.costCad == null ? "—" : money(l.costCad)}
                  </td>
                  <td className="num">{money(l.mvCad)}</td>
                  <td className={"num " + (pos ? "pl-pos" : "pl-neg")}>
                    {l.uplCad == null ? "—" : signMoney(l.uplCad)}
                    {l.uplPct == null ? null : (
                      <span
                        className={"pl-chip " + (pos ? "pos" : "neg")}
                        style={{ marginLeft: 6 }}
                      >
                        {pct(l.uplPct)}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    <div className="own-pct">
                      <span>{l.weight.toFixed(1)}%</span>
                      <i className="own-pct-bar">
                        <i style={{ width: l.weight + "%" }} />
                      </i>
                    </div>
                  </td>
                  <td className="t-acct">{dash(l.since)}</td>
                </tr>
              );
            })}
            <tr className="own-total">
              <td>
                <strong style={{ color: "var(--text)" }}>Total · all accounts</strong>
              </td>
              <td className="num">
                {p.totalUnits.toLocaleString("en-US", { maximumFractionDigits: 3 })}
              </td>
              <td className="num">{p.avgNative == null ? "—" : money(p.avgNative)}</td>
              <td className="num">{p.costCad == null ? "—" : money(p.costCad)}</td>
              <td className="num">{money(p.mvCad)}</td>
              <td className={"num " + (upPos ? "pl-pos" : "pl-neg")}>
                {p.uplCad == null ? "—" : signMoney(p.uplCad)}
                {p.uplPct == null ? null : (
                  <span className={"pl-chip " + (upPos ? "pos" : "neg")} style={{ marginLeft: 6 }}>
                    {pct(p.uplPct)}
                  </span>
                )}
              </td>
              <td className="num">100.0%</td>
              <td className="t-acct">{yrs}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── activity ────────────────────────────────────────────────────────────
function Activity({ p }: { p: PositionDetail }) {
  const [filter, setFilter] = useState<"ALL" | "TRADES" | "DIV">("ALL");
  const [acct, setAcct] = useState("ALL");
  const accts = [...new Set(p.activity.map((a) => a.accountLabel))];

  const matchesFilter = (a: PositionActivityRow) =>
    filter === "ALL" ? true : filter === "TRADES" ? a.group === "trade" : a.group === "income";
  const rows = p.activity.filter(
    (a) => matchesFilter(a) && (acct === "ALL" || a.accountLabel === acct)
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="panel-title">Trades, dividends &amp; income</div>
          <div className="panel-meta">
            {rows.length} OF {p.activity.length} ROWS
          </div>
        </div>
        <div className="pos-filter-row">
          <div className="pos-seg">
            {(["ALL", "TRADES", "DIV"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? "on" : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          {accts.length > 1 ? (
            <div className="pos-seg">
              <button
                type="button"
                className={acct === "ALL" ? "on" : ""}
                onClick={() => setAcct("ALL")}
              >
                ALL
              </button>
              {accts.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={acct === a ? "on" : ""}
                  onClick={() => setAcct(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="panel-body flush">
        {rows.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-3)" }}>
            No activity synced for this holding.
          </div>
        ) : (
          <table className="table act-mini-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th style={{ width: 70 }}>Type</th>
                <th style={{ width: 76 }}>Account</th>
                <th>Description</th>
                <th className="num" style={{ width: 70 }}>
                  Units
                </th>
                <th className="num" style={{ width: 92 }}>
                  Price {p.currency}
                </th>
                <th className="num" style={{ width: 104 }}>
                  Amount CAD
                </th>
                <th className="num" style={{ width: 70 }}>
                  FX
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const typeCls =
                  r.type === "BUY"
                    ? "buy"
                    : r.type === "SELL"
                      ? "sell"
                      : r.group === "income"
                        ? "div"
                        : "";
                const amtPos = (r.amountCad ?? 0) > 0;
                return (
                  <tr key={r.id}>
                    <td className="t-date">{fmtDate(r.tradeDate)}</td>
                    <td>
                      <span className={"act-type " + typeCls}>{shortLabel(r.type)}</span>
                    </td>
                    <td>
                      <span className="acct-reg-chip mini">{r.accountLabel}</span>
                    </td>
                    <td className="desc-cell">
                      {r.description ??
                        (r.type === "BUY" && r.units != null && r.price != null
                          ? `Bought ${Math.abs(r.units)} ${p.symbol} @ ${money(r.price)}`
                          : r.type === "SELL" && r.units != null && r.price != null
                            ? `Sold ${Math.abs(r.units)} ${p.symbol} @ ${money(r.price)}`
                            : r.group === "income"
                              ? `Cash distribution · ${p.symbol}`
                              : `${shortLabel(r.type)} · ${p.symbol}`)}
                    </td>
                    <td className="num">
                      {r.units == null
                        ? "—"
                        : r.units.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="num" style={{ color: "var(--text-3)" }}>
                      {r.price == null ? "—" : r.price.toFixed(2)}
                    </td>
                    <td className={"num " + (amtPos ? "pl-pos" : "pl-neg")}>
                      {r.amountCad == null ? "—" : signMoney(r.amountCad)}
                    </td>
                    <td className="num" style={{ color: "var(--text-4)" }}>
                      {r.fxRate == null ? "—" : r.fxRate.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── exposure ──────────────────────────────────────────────────────────────
function Exposure({ p }: { p: PositionDetail }) {
  const ex = p.exposure;
  const bars = [
    {
      lbl: "Portfolio weight",
      v: ex.weight,
      max: 15,
      color: "var(--accent)",
      delta: undefined as number | undefined,
    },
    {
      lbl: `${p.currency} currency share`,
      v: ex.currencyShare,
      max: 100,
      color: "var(--cat-4)",
      delta: ex.currencyShareDelta,
    },
    {
      lbl: "Contribution to open P&L",
      v: ex.contribPnlPct,
      max: 100,
      color: "var(--pos)",
      delta: undefined,
    },
  ];
  const accounts = [...new Set(p.lots.map((l) => l.accountLabel))].join(" · ");
  return (
    <div className="pos-exp-grid">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">How this position contributes</div>
          <div className="panel-meta">PORTFOLIO IMPACT</div>
        </div>
        <div className="panel-body">
          <div className="pos-exp-bars">
            {bars.map((b, i) => (
              <div key={i} className="pos-exp-bar">
                <div className="pos-exp-bar-head">
                  <span className="lbl">{b.lbl}</span>
                  <span className="v" style={{ color: "var(--text)" }}>
                    {b.v.toFixed(1)}%
                    {b.delta != null ? (
                      <span className="pos-pill pos" style={{ marginLeft: 6 }}>
                        +{b.delta.toFixed(1)} pts
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="pos-exp-track">
                  <i
                    style={{ width: Math.min((b.v / b.max) * 100, 100) + "%", background: b.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Classification</div>
          <div className="panel-meta">FROM YOUR BROKERAGE</div>
        </div>
        <div className="panel-body">
          <div className="pos-cls-grid">
            <ClsRow lbl="Asset type" v={p.isFund ? "ETF · Pooled fund" : p.type} />
            <ClsRow lbl="Currency" v={p.currency} />
            <ClsRow lbl="Exchange" v={p.exchange || "—"} />
            <ClsRow lbl="Accounts" v={accounts} />
            <ClsRow lbl="Held in" v={p.lots[0]?.institution ?? "—"} />
            <ClsRow lbl="Sector" v="Source pending" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ClsRow({ lbl, v }: { lbl: string; v: string }) {
  return (
    <div className="pos-cls-row">
      <span className="lbl">{lbl}</span>
      <span className="v">{v}</span>
    </div>
  );
}

// ─── rail ────────────────────────────────────────────────────────────────
function Rail({ p }: { p: PositionDetail }) {
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
