import type { PositionDetail } from "@/lib/investments/types";

function ClsRow({ lbl, v }: { lbl: string; v: string }) {
  return (
    <div className="pos-cls-row">
      <span className="lbl">{lbl}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function Exposure({ p }: { p: PositionDetail }) {
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
