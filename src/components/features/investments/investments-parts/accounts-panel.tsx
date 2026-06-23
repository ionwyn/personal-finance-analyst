import { InstitutionLogo } from "@/components/shared/institution-logo";
import { formatMoney, formatYearMonth } from "@/lib/format";
import type { InvestmentDashboardData } from "@/lib/investments/types";

export function AccountsPanel({ accounts }: { accounts: InvestmentDashboardData["accounts"] }) {
  const netWorth = accounts.reduce((s, a) => s + a.totalValue, 0);
  const liabilities = accounts.reduce((s, a) => s + a.liabilityCAD, 0);
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <div className="panel-title">Accounts</div>
        <div className="panel-meta">
          {accounts.length} {accounts.length === 1 ? "ACCOUNT" : "ACCOUNTS"}
        </div>
      </div>
      <div className="panel-body flush">
        <div className="brok-list">
          {accounts.map((a) => {
            const badge = !a.initialSyncComplete
              ? { cls: "warn", label: "INITIAL SYNC" }
              : a.isStale
                ? { cls: "warn", label: "STALE" }
                : null;
            // For a credit card we show the carried balance as the debt owed
            // (negative); other accounts show their net value.
            const displayValue = a.isLiability ? -a.liabilityCAD : a.totalValue;
            const subline =
              a.isMargin && a.liabilityCAD > 0
                ? `${a.positionCount} positions · ${formatMoney(a.liabilityCAD)} margin loan`
                : a.isLiability
                  ? "balance to pay off"
                  : `${a.positionCount} positions`;
            return (
              <div className="brok-row" key={a.id}>
                <InstitutionLogo
                  name={a.institution}
                  logo={a.institutionLogo}
                  bg={a.institutionLogoBg}
                  size={28}
                  radius={5}
                />
                <div>
                  <div className="nm">{a.name}</div>
                  <div className="meta">{subline}</div>
                </div>
                <span className="reg-cell">
                  <span className={`status ${a.isLiability ? "warn" : "reg"}`}>
                    <i className="pulse" />
                    {a.registration}
                  </span>
                  {badge ? (
                    <span className={`status ${badge.cls}`} title={badge.label}>
                      <i className="pulse" />
                      {badge.label}
                    </span>
                  ) : null}
                </span>
                <span className="meta">{a.currency}</span>
                <span className="opened">
                  opened {a.openedAt ? formatYearMonth(a.openedAt) : "—"}
                </span>
                <span
                  className="val"
                  style={displayValue < 0 ? { color: "var(--neg)" } : undefined}
                >
                  {formatMoney(displayValue)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="brok-foot">
          <span className="lbl">Net worth</span>
          {liabilities > 0 ? (
            <span className="meta" style={{ color: "var(--neg)" }}>
              {formatMoney(-liabilities)} liabilities
            </span>
          ) : null}
          <span className="val">{formatMoney(netWorth)}</span>
        </div>
      </div>
    </div>
  );
}
