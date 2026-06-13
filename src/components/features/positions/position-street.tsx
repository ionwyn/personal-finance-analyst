"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PositionMarketData } from "@/lib/market-data";

// ─── Street data: analyst consensus + dividend history ─────────────────────
// Third-party aggregates surfaced as-is. Framed as data, never as advice.

const REC_LABEL: Record<string, string> = {
  strong_buy: "STRONG BUY",
  buy: "BUY",
  hold: "HOLD",
  underperform: "UNDERPERFORM",
  sell: "SELL",
};

// ─── Analyst consensus ──────────────────────────────────────────────────────

export function AnalystPanel({ md }: { md: PositionMarketData | null }) {
  const a = md?.analyst;
  const price = md?.quote?.price ?? null;
  if (!a || (a.targetMean == null && a.analystCount == null)) return null;

  const lo = a.targetLow;
  const hi = a.targetHigh;
  const mean = a.targetMean;
  const span = lo != null && hi != null && hi > lo ? hi - lo : null;
  const posOf = (v: number) =>
    span != null && lo != null ? Math.max(0, Math.min(100, ((v - lo) / span) * 100)) : 50;

  const upside = mean != null && price != null && price > 0 ? ((mean - price) / price) * 100 : null;

  const dist = [
    { k: "strongBuy", lbl: "Strong buy", v: a.strongBuy ?? 0, color: "var(--pos)" },
    { k: "buy", lbl: "Buy", v: a.buy ?? 0, color: "var(--pos-dim)" },
    { k: "hold", lbl: "Hold", v: a.hold ?? 0, color: "var(--text-4)" },
    { k: "sell", lbl: "Sell", v: a.sell ?? 0, color: "var(--neg-dim)" },
    { k: "strongSell", lbl: "Strong sell", v: a.strongSell ?? 0, color: "var(--neg)" },
  ];
  const totalRecs = dist.reduce((s, d) => s + d.v, 0);

  return (
    <div className="panel pos-street">
      <div className="panel-head">
        <div className="panel-title">Street consensus</div>
        <div className="panel-meta">
          {a.analystCount != null ? `${a.analystCount} ANALYSTS · ` : ""}THIRD-PARTY DATA — NOT
          ADVICE
        </div>
      </div>
      <div className="panel-body">
        <div className="pos-street-grid">
          <div className="pos-street-targets">
            <div className="pos-street-row-head">
              <span className="lbl">12-MO PRICE TARGETS</span>
              {a.recKey && (
                <span className="rec">
                  {REC_LABEL[a.recKey] ?? a.recKey.toUpperCase()}
                  {a.recMean != null && <em> · {a.recMean.toFixed(1)} / 5</em>}
                </span>
              )}
            </div>
            {lo != null && hi != null && span != null ? (
              <>
                <div className="pos-target-track">
                  {mean != null && (
                    <i
                      className="pin mean"
                      style={{ left: posOf(mean) + "%" }}
                      title={`Mean $${mean.toFixed(2)}`}
                    />
                  )}
                  {price != null && (
                    <i
                      className="pin px"
                      style={{ left: posOf(price) + "%" }}
                      title={`Current $${price.toFixed(2)}`}
                    />
                  )}
                </div>
                <div className="pos-target-scale">
                  <span>
                    LOW <b>${lo.toFixed(0)}</b>
                  </span>
                  <span className="mid">
                    MEAN <b className="mean">${mean != null ? mean.toFixed(0) : "—"}</b>
                    {upside != null && (
                      <em className={upside >= 0 ? "pos" : "neg"}>
                        {(upside >= 0 ? "+" : "−") + Math.abs(upside).toFixed(1)}% vs price
                      </em>
                    )}
                  </span>
                  <span className="hi">
                    HIGH <b>${hi.toFixed(0)}</b>
                  </span>
                </div>
              </>
            ) : (
              <div className="pos-street-none">No published targets.</div>
            )}
          </div>

          {totalRecs > 0 && (
            <div className="pos-street-recs">
              <div className="pos-street-row-head">
                <span className="lbl">RECOMMENDATION MIX</span>
                <span className="n">{totalRecs} RATINGS</span>
              </div>
              <div className="pos-rec-bar">
                {dist
                  .filter((d) => d.v > 0)
                  .map((d) => (
                    <i
                      key={d.k}
                      style={{ width: (d.v / totalRecs) * 100 + "%", background: d.color }}
                      title={`${d.lbl}: ${d.v}`}
                    />
                  ))}
              </div>
              <div className="pos-rec-legend">
                {dist
                  .filter((d) => d.v > 0)
                  .map((d) => (
                    <span key={d.k}>
                      <i style={{ background: d.color }} />
                      {d.lbl} <b>{d.v}</b>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dividend history ───────────────────────────────────────────────────────

function DivTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      <div className="tt-row">
        <span className="k">
          <i className="tt-sw" style={{ background: "var(--accent)" }} />
          Per share
        </span>
        <span className="v">${payload[0].value.toFixed(4)}</span>
      </div>
    </div>
  );
}

function computeDividendStats(dividends: { date: string; amount: number }[]) {
  const now = Date.now();
  const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoYearsAgo = new Date(now - 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const ttm = dividends.filter((d) => d.date >= yearAgo).reduce((s, d) => s + d.amount, 0);
  const prior = dividends
    .filter((d) => d.date >= twoYearsAgo && d.date < yearAgo)
    .reduce((s, d) => s + d.amount, 0);
  const growth = prior > 0 ? ((ttm - prior) / prior) * 100 : null;

  const data = dividends.slice(-20).map((d) => ({
    label: new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    amount: d.amount,
    recent: d.date >= yearAgo,
  }));

  return { ttm, growth, data };
}

export function DividendsPanel({
  md,
  currency,
  units,
}: {
  md: PositionMarketData | null;
  currency: string;
  /** Units held — enables the personal forward-income estimate. */
  units?: number | null;
}) {
  const dividends = md?.dividends ?? [];
  if (dividends.length === 0) return null;

  const { ttm, growth, data } = computeDividendStats(dividends);

  const annualIncome = units != null && units > 0 && ttm > 0 ? units * ttm : null;

  return (
    <div className="panel pos-divs">
      <div className="panel-head">
        <div className="panel-title">Dividend history</div>
        <div className="panel-meta">PER SHARE · EX-DATE · {currency}</div>
      </div>
      <div className="panel-body">
        <div className="pos-divs-stats">
          <div>
            <span className="lbl">TTM / SHARE</span>
            <span className="val">${ttm.toFixed(2)}</span>
          </div>
          <div>
            <span className="lbl">YOY GROWTH</span>
            <span className={"val " + (growth == null ? "" : growth >= 0 ? "pos" : "neg")}>
              {growth == null ? "—" : (growth >= 0 ? "+" : "−") + Math.abs(growth).toFixed(1) + "%"}
            </span>
          </div>
          <div>
            <span className="lbl">PAYMENTS · 5Y</span>
            <span className="val">{dividends.length}</span>
          </div>
          {annualIncome != null && (
            <div className="mine">
              <span className="lbl">MY EST. ANNUAL INCOME</span>
              <span className="val">
                ${annualIncome.toFixed(0)} <em>{currency} · units × TTM</em>
              </span>
            </div>
          )}
        </div>
        <div style={{ width: "100%", height: 120 }}>
          <ResponsiveContainer initialDimension={{ width: 1, height: 1 }}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(data.length / 6) - 1)}
                tick={{ fontSize: 9, fill: "var(--text-4)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 9, fill: "var(--text-4)" }}
                tickFormatter={(v: number) => "$" + v.toFixed(2)}
              />
              <Tooltip content={<DivTooltip />} cursor={{ fill: "var(--hover)" }} />
              <Bar dataKey="amount" radius={[2, 2, 0, 0]} maxBarSize={18}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.recent ? "var(--accent)" : "var(--accent-dim)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
