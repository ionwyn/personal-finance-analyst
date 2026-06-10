import type { PositionDetail } from "@/lib/investments/types";

import { dash, money, pct, signMoney } from "../format";

export function Ownership({ p }: { p: PositionDetail }) {
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
