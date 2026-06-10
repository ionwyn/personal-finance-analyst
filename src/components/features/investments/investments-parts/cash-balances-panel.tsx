import { formatMoney } from "@/lib/format";
import type { InvestmentDashboardData } from "@/lib/investments/types";

export function CashBalancesPanel({
  cashByCcy,
}: {
  cashByCcy: InvestmentDashboardData["summary"]["cashByCcy"];
}) {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div className="panel-title">Cash balances</div>
        <div className="panel-meta">{cashByCcy.length} CURRENCIES</div>
      </div>
      <div className="panel-body flush">
        <table className="table">
          <thead>
            <tr>
              <th>Currency</th>
              <th className="num">Balance</th>
              <th className="num">CAD-eq.</th>
              <th className="num">Buying power</th>
            </tr>
          </thead>
          <tbody>
            {cashByCcy.map((c) => (
              <tr key={c.currency}>
                <td>
                  <span className="ccy-tag">{c.currency}</span>
                </td>
                <td className="num">{formatMoney(c.value)}</td>
                <td className="num" style={{ color: "var(--text-3)" }}>
                  {formatMoney(c.valueCAD)}
                </td>
                <td className="num">{formatMoney(c.buyingPower)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
