import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import type { PositionDetail } from "@/lib/investments/types";

import { money, pct, signMoney } from "../format";

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

export function Hero({ p }: { p: PositionDetail }) {
  const uplPos = (p.uplCad ?? 0) >= 0;
  const trPos = (p.performance.totalReturnCad ?? 0) >= 0;
  const isUsd = p.currency.toUpperCase() === "USD";
  const quote = p.marketData?.quote ?? null;
  const livePrice = quote?.price ?? p.price;
  return (
    <div className="pos-hero">
      <div className="pos-hero-row">
        <div className="pos-hero-id">
          <Link href={"/app/portfolio" as never} className="pos-back">
            <ChevronLeft size={11} />
            Back to Portfolio
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
            {livePrice.toFixed(2)}
            <span className="px-ccy">{p.currency}</span>
          </div>
          <div className="pos-day-row">
            {quote ? (
              <>
                <span className={"sym-day " + (quote.changePct >= 0 ? "pos" : "neg")}>
                  {(quote.changePct >= 0 ? "+" : "−") + Math.abs(quote.change).toFixed(2)} (
                  {(quote.changePct >= 0 ? "+" : "−") + Math.abs(quote.changePct).toFixed(2)}%)
                  today
                </span>
                <span className="pos-day-meta"> · DELAYED QUOTE</span>
              </>
            ) : (
              <span className="pos-day-meta">LAST SYNCED PRICE</span>
            )}
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
