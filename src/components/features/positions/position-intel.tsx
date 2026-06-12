"use client";

import { ExternalLink } from "lucide-react";

import type {
  AnnualFinancials,
  EarningsQuarter,
  InsiderTx,
  RecTrendMonth,
  SecFiling,
} from "@/lib/market-data";
import type { PeerQuoteRow } from "@/lib/investments/intel-loader";

// ─── Street intelligence panels ─────────────────────────────────────────────
// Finnhub / EDGAR / FMP research data, shared by the position and symbol
// views. Every panel returns null when its dataset is empty (funds, TSX
// listings, thin coverage) so sections compose without placeholders. All
// figures are third-party data surfaced as-is — framing stays descriptive.

/** True when at least one street-intelligence panel will render. */
export function hasIntel(i: {
  earnings: EarningsQuarter[];
  recTrends: RecTrendMonth[];
  insiders: InsiderTx[];
  peerRows: PeerQuoteRow[];
  filings: SecFiling[];
}): boolean {
  return (
    i.earnings.some((e) => e.surprisePct != null) ||
    i.recTrends.length >= 2 ||
    i.insiders.some((t) => !t.isDerivative && t.txDate != null) ||
    i.peerRows.length >= 2 ||
    i.filings.length > 0
  );
}

const compact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
};

const signed = (n: number, digits = 1): string =>
  (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(digits);

/** "2026-03-31" → "Q1 '26" (calendar quarter of the fiscal period end). */
function quarterLabel(e: EarningsQuarter): string {
  if (e.quarter != null && e.year != null) return `Q${e.quarter} '${String(e.year).slice(2)}`;
  const m = Number(e.period.slice(5, 7));
  return `Q${Math.ceil(m / 3)} '${e.period.slice(2, 4)}`;
}

/** "2026-06-01" → "Jun" */
function monthLabel(period: string): string {
  return new Date(period + "T12:00:00Z").toLocaleDateString("en-US", { month: "short" });
}

function filedLabel(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

// ─── Earnings vs street ─────────────────────────────────────────────────────

export function EarningsPanel({ earnings }: { earnings: EarningsQuarter[] }) {
  const rows = earnings.filter((e) => e.surprisePct != null).slice(-8);
  if (rows.length === 0) return null;

  const beats = rows.filter((e) => (e.surprisePct ?? 0) >= 0).length;
  const avg = rows.reduce((s, e) => s + (e.surprisePct ?? 0), 0) / rows.length;
  const maxAbs = Math.max(...rows.map((e) => Math.abs(e.surprisePct ?? 0)), 0.1);

  return (
    <div className="panel pos-earn">
      <div className="panel-head">
        <div className="panel-title">Earnings vs street</div>
        <div className="panel-meta">EPS SURPRISE · THIRD-PARTY DATA — NOT ADVICE</div>
      </div>
      <div className="panel-body">
        <div className="pos-earn-stats">
          <div>
            <span className="lbl">BEAT RATE</span>
            <span className="val">
              {beats}/{rows.length} <em>quarters</em>
            </span>
          </div>
          <div>
            <span className="lbl">AVG SURPRISE</span>
            <span className={"val " + (avg >= 0 ? "pos" : "neg")}>{signed(avg)}%</span>
          </div>
          <div>
            <span className="lbl">LAST QUARTER</span>
            <span className={"val " + ((rows.at(-1)!.surprisePct ?? 0) >= 0 ? "pos" : "neg")}>
              {signed(rows.at(-1)!.surprisePct ?? 0)}%
            </span>
          </div>
        </div>
        <div className="pos-earn-chart">
          {rows.map((e) => {
            const s = e.surprisePct ?? 0;
            const h = Math.max(3, (Math.abs(s) / maxAbs) * 34);
            const beat = s >= 0;
            return (
              <div key={e.period} className="pos-earn-col">
                <div className={"surp " + (beat ? "pos" : "neg")}>{signed(s)}%</div>
                <div className="well">
                  <i
                    className={beat ? "pos" : "neg"}
                    style={beat ? { height: h, bottom: "50%" } : { height: h, top: "50%" }}
                  />
                  <span className="baseline" />
                </div>
                <div className="q">{quarterLabel(e)}</div>
                <div className="eps">
                  <b>{e.epsActual != null ? e.epsActual.toFixed(2) : "—"}</b>
                  <em>/{e.epsEstimate != null ? e.epsEstimate.toFixed(2) : "—"}</em>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pos-earn-foot">ACT / EST · EPS, NATIVE CURRENCY</div>
      </div>
    </div>
  );
}

// ─── Recommendation momentum ────────────────────────────────────────────────

const REC_SEGMENTS = [
  { key: "strongBuy", lbl: "Strong buy", color: "var(--pos)" },
  { key: "buy", lbl: "Buy", color: "var(--pos-dim)" },
  { key: "hold", lbl: "Hold", color: "var(--text-4)" },
  { key: "sell", lbl: "Sell", color: "var(--neg-dim)" },
  { key: "strongSell", lbl: "Strong sell", color: "var(--neg)" },
] as const;

export function RecMomentumPanel({ recTrends }: { recTrends: RecTrendMonth[] }) {
  const rows = recTrends.slice(-6).reverse(); // newest first
  if (rows.length < 2) return null;

  const buys = (r: RecTrendMonth) => r.strongBuy + r.buy;
  const delta = buys(rows[0]) - buys(rows.at(-1)!);
  const span = rows.length - 1;

  return (
    <div className="panel pos-recmo">
      <div className="panel-head">
        <div className="panel-title">Recommendation momentum</div>
        <div className="panel-meta">MONTHLY · THIRD-PARTY DATA — NOT ADVICE</div>
      </div>
      <div className="panel-body">
        <div className="pos-recmo-rows">
          {rows.map((r) => {
            const total = REC_SEGMENTS.reduce((s, seg) => s + r[seg.key], 0);
            return (
              <div key={r.period} className="pos-recmo-row">
                <span className="mo">{monthLabel(r.period)}</span>
                <div className="bar">
                  {REC_SEGMENTS.filter((seg) => r[seg.key] > 0).map((seg) => (
                    <i
                      key={seg.key}
                      style={{
                        width: total > 0 ? (r[seg.key] / total) * 100 + "%" : 0,
                        background: seg.color,
                      }}
                      title={`${seg.lbl}: ${r[seg.key]}`}
                    />
                  ))}
                </div>
                <span className="n">{total}</span>
              </div>
            );
          })}
        </div>
        <div className="pos-recmo-foot">
          <span className="pos-recmo-delta">
            BUY-RATED ANALYSTS{" "}
            <b className={delta > 0 ? "pos" : delta < 0 ? "neg" : ""}>
              {delta === 0 ? "unch" : signed(delta, 0)}
            </b>{" "}
            <em>
              / {span} mo{span > 1 ? "s" : ""}
            </em>
          </span>
          <span className="pos-recmo-legend">
            {REC_SEGMENTS.map((seg) => (
              <span key={seg.key}>
                <i style={{ background: seg.color }} />
                {seg.lbl}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Insider activity ───────────────────────────────────────────────────────

const TX_CODE_LABEL: Record<string, string> = {
  P: "Open-market buy",
  S: "Open-market sale",
  M: "Option exercise",
  A: "Grant / award",
  F: "Tax withholding",
  G: "Gift",
  D: "Disposition",
  C: "Conversion",
};

const txValue = (t: InsiderTx) =>
  t.change != null && t.txPrice != null && t.txPrice > 0 ? t.change * t.txPrice : null;

function summarizeInsiders(market: InsiderTx[]) {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const window90 = market.filter((t) => (t.txDate ?? "") >= cutoff);
  let boughtUsd = 0;
  let soldUsd = 0;
  for (const t of window90) {
    const v = txValue(t);
    if (v != null && v > 0) boughtUsd += v;
    if (v != null && v < 0) soldUsd += Math.abs(v);
  }
  return { boughtUsd, soldUsd, people: new Set(window90.map((t) => t.name)).size };
}

export function InsiderPanel({ insiders }: { insiders: InsiderTx[] }) {
  // Open-market rows tell the story; derivative legs (price 0) are noise.
  const market = insiders.filter((t) => !t.isDerivative && t.txDate != null);
  if (market.length === 0) return null;

  const { boughtUsd, soldUsd, people } = summarizeInsiders(market);

  return (
    <div className="panel pos-insider">
      <div className="panel-head">
        <div className="panel-title">Insider activity</div>
        <div className="panel-meta">SEC FORMS 3/4/5 · NON-DERIVATIVE</div>
      </div>
      <div className="panel-body">
        <div className="pos-insider-stats">
          <div>
            <span className="lbl">BOUGHT · 90D</span>
            <span className={"val" + (boughtUsd > 0 ? " pos" : "")}>
              {boughtUsd > 0 ? "$" + compact(boughtUsd) : "—"}
            </span>
          </div>
          <div>
            <span className="lbl">SOLD · 90D</span>
            <span className={"val" + (soldUsd > 0 ? " neg" : "")}>
              {soldUsd > 0 ? "$" + compact(soldUsd) : "—"}
            </span>
          </div>
          <div>
            <span className="lbl">INSIDERS · 90D</span>
            <span className="val">{people || "—"}</span>
          </div>
        </div>
        <div className="pos-insider-table">
          {market.slice(0, 8).map((t, i) => {
            const v = txValue(t);
            const code = t.txCode ?? "?";
            return (
              <div key={i} className="pos-insider-row">
                <span className="date">{t.txDate?.slice(2).replace(/-/g, "·") ?? "—"}</span>
                <span className="who" title={t.name}>
                  {t.name.toLowerCase()}
                </span>
                <span
                  className={"code " + (code === "P" ? "buy" : code === "S" ? "sell" : "other")}
                  title={TX_CODE_LABEL[code] ?? "Other transaction"}
                >
                  {code}
                </span>
                <span className={"shares " + ((t.change ?? 0) >= 0 ? "pos" : "neg")}>
                  {t.change != null ? signed(t.change, 0).replace(/[+−]/, (m) => m) : "—"}
                </span>
                <span className="px">
                  {t.txPrice != null && t.txPrice > 0 ? "@" + t.txPrice.toFixed(2) : ""}
                </span>
                <span className={"usd " + ((v ?? 0) >= 0 ? "pos" : "neg")}>
                  {v != null ? "$" + compact(Math.abs(v)) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Peer tape ──────────────────────────────────────────────────────────────

export function PeersPanel({ peerRows }: { peerRows: PeerQuoteRow[] }) {
  if (peerRows.length < 2) return null;
  const rows = [...peerRows].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));

  return (
    <div className="panel pos-peers">
      <div className="panel-head">
        <div className="panel-title">Peer tape</div>
        <div className="panel-meta">SAME INDUSTRY · DELAYED QUOTES</div>
      </div>
      <div className="panel-body flush">
        <div className="pos-peers-table">
          <div className="pos-peers-row head">
            <span>SYM</span>
            <span className="num">LAST</span>
            <span className="num">DAY</span>
            <span className="num">MKT CAP</span>
            <span className="range">52W RANGE</span>
          </div>
          {rows.map((r) => (
            <div key={r.symbol} className={"pos-peers-row" + (r.isSelf ? " self" : "")}>
              <span className="sym">
                {r.symbol}
                {r.isSelf && <em>THIS</em>}
              </span>
              <span className="num">{r.price.toFixed(2)}</span>
              <span className={"num " + (r.changePct >= 0 ? "pos" : "neg")}>
                {signed(r.changePct, 2)}%
              </span>
              <span className="num">{r.marketCap != null ? "$" + compact(r.marketCap) : "—"}</span>
              <span className="range">
                <span className="track">
                  {r.rangePos52w != null && <i style={{ left: r.rangePos52w + "%" }} />}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SEC filings ────────────────────────────────────────────────────────────

// Fallback titles when EDGAR's primaryDocDescription just repeats the form.
const FORM_DESC: Record<string, string> = {
  "10-K": "Annual report",
  "10-Q": "Quarterly report",
  "8-K": "Current report (material event)",
  "20-F": "Annual report (foreign issuer)",
  "40-F": "Annual report (Canadian issuer)",
  "6-K": "Foreign issuer report",
  "DEF 14A": "Proxy statement",
  DEFM14A: "Merger proxy statement",
  "S-1": "Registration statement",
  "S-3": "Shelf registration",
  "S-8": "Employee stock plan registration",
  "SC 13D": "Activist ownership >5%",
  "SC 13G": "Passive ownership >5%",
  "424B5": "Prospectus supplement",
};

function formTone(form: string): string {
  const base = form.replace(/\/A$/, "");
  if (base === "10-K" || base === "20-F" || base === "40-F") return "annual";
  if (base === "10-Q" || base === "6-K") return "quarterly";
  if (base === "8-K") return "event";
  return "other";
}

export function FilingsPanel({ filings }: { filings: SecFiling[] }) {
  if (filings.length === 0) return null;

  return (
    <div className="panel pos-filings">
      <div className="panel-head">
        <div className="panel-title">SEC filings</div>
        <div className="panel-meta">EDGAR · PRIMARY DOCUMENTS</div>
      </div>
      <div className="panel-body flush">
        <div className="pos-filings-list">
          {filings.slice(0, 8).map((f) => (
            <a
              key={f.accession}
              className="pos-filings-row"
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={"form " + formTone(f.form)}>{f.form}</span>
              <span className="title">
                {f.title && f.title !== f.form
                  ? f.title
                  : (FORM_DESC[f.form.replace(/\/A$/, "")] ?? "Filing")}
              </span>
              <span className="date">{filedLabel(f.filedAt)}</span>
              <ExternalLink size={10} className="ext" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Annual financials ──────────────────────────────────────────────────────

export function FinancialsPanel({ financials }: { financials: AnnualFinancials[] }) {
  const rows = financials.filter((f) => f.revenue != null).slice(-5);
  if (rows.length < 2) return null;

  const maxRev = Math.max(...rows.map((f) => f.revenue ?? 0));
  const first = rows[0];
  const last = rows.at(-1)!;
  const years = rows.length - 1;
  const cagr =
    first.revenue && last.revenue && first.revenue > 0
      ? (Math.pow(last.revenue / first.revenue, 1 / years) - 1) * 100
      : null;
  const lastMargin =
    last.netIncome != null && last.revenue ? (last.netIncome / last.revenue) * 100 : null;

  return (
    <div className="panel pos-fins">
      <div className="panel-head">
        <div className="panel-title">Annual financials</div>
        <div className="panel-meta">FISCAL YEARS · {last.currency ?? "USD"} · AS REPORTED</div>
      </div>
      <div className="panel-body">
        <div className="pos-fins-stats">
          <div>
            <span className="lbl">REVENUE CAGR · {years}Y</span>
            <span className={"val " + ((cagr ?? 0) >= 0 ? "pos" : "neg")}>
              {cagr != null ? signed(cagr) + "%" : "—"}
            </span>
          </div>
          <div>
            <span className="lbl">NET MARGIN · FY{last.fiscalYear.slice(2)}</span>
            <span className={"val " + ((lastMargin ?? 0) >= 0 ? "" : "neg")}>
              {lastMargin != null ? lastMargin.toFixed(1) + "%" : "—"}
            </span>
          </div>
        </div>
        <div className="pos-fins-chart">
          {rows.map((f) => {
            const margin =
              f.netIncome != null && f.revenue ? (f.netIncome / f.revenue) * 100 : null;
            return (
              <div key={f.fiscalYear} className="pos-fins-col">
                <div className="well">
                  <i style={{ height: Math.max(4, ((f.revenue ?? 0) / maxRev) * 56) + "px" }} />
                </div>
                <div className="fy">FY{f.fiscalYear.slice(2)}</div>
                <div className="rev">${compact(f.revenue ?? 0)}</div>
                <div className={"net " + ((f.netIncome ?? 0) >= 0 ? "" : "neg")}>
                  {f.netIncome != null ? "$" + compact(f.netIncome) : "—"}
                  {margin != null && <em>{margin.toFixed(0)}%</em>}
                </div>
                <div className="eps">{f.epsDiluted != null ? f.epsDiluted.toFixed(2) : "—"}</div>
              </div>
            );
          })}
        </div>
        <div className="pos-fins-foot">
          <span>BARS — REVENUE</span>
          <span>ROWS — NET INCOME · MARGIN · DILUTED EPS</span>
        </div>
      </div>
    </div>
  );
}
