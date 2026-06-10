import { formatMoney, formatYearMonth } from "@/lib/format";
import type { InvestmentDashboardData } from "@/lib/investments/types";

export function AccountsPanel({ accounts }: { accounts: InvestmentDashboardData["accounts"] }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <div className="panel-title">Accounts</div>
        <div className="panel-meta">
          {accounts.length} {accounts.length === 1 ? "REGISTERED" : "ACCOUNTS"}
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
            return (
              <div className="brok-row" key={a.id}>
                <div
                  className="sym-logo"
                  style={{
                    background: a.institutionLogoBg,
                    width: 28,
                    height: 28,
                    fontSize: 10,
                  }}
                >
                  {a.institutionLogoText}
                </div>
                <div>
                  <div className="nm">{a.name}</div>
                  <div className="meta">{a.positionCount} positions</div>
                </div>
                <span className="reg-cell">
                  <span className="status reg">
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
                <span className="val">{formatMoney(a.totalValue)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
