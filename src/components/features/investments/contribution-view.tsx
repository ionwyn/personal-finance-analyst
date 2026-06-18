"use client";

import { useState } from "react";

import { SnapTradeLinkButton, SnapTradeSyncButton } from "@/components/actions/snaptrade-actions";
import { formatMoney } from "@/lib/format";
import type { ContributionData, ContributionYear } from "@/lib/investments/types";

import { ContributionChart } from "./contribution-chart";
import { PortfolioTabs } from "./portfolio-tabs";

function YearRow({
  yr,
  expanded,
  onToggle,
}: {
  yr: ContributionYear;
  expanded: boolean;
  onToggle: () => void;
}) {
  const netPos = yr.netCad >= 0;
  return (
    <>
      <tr className="contrib-year-row" onClick={onToggle} style={{ cursor: "pointer" }}>
        <td className="contrib-year">{yr.year}</td>
        <td className="num contrib-in">{formatMoney(yr.contributionCad)}</td>
        <td className="num contrib-out">
          {yr.withdrawalCad > 0 ? "−" + formatMoney(yr.withdrawalCad).replace(/^-/, "") : "—"}
        </td>
        <td className={`num contrib-net ${netPos ? "pl-pos" : "pl-neg"}`}>
          {formatMoney(yr.netCad, { sign: true })}
        </td>
        <td className="contrib-expand">{expanded ? "▲" : "▼"}</td>
      </tr>
      {expanded &&
        yr.months.map((m) => {
          const mNetPos = m.contributionCad - m.withdrawalCad >= 0;
          return (
            <tr key={m.month} className="contrib-month-row">
              <td className="contrib-month-label">
                {new Date(m.month + "-15").toLocaleString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </td>
              <td className="num contrib-in">
                {m.contributionCad > 0 ? formatMoney(m.contributionCad) : "—"}
              </td>
              <td className="num contrib-out">
                {m.withdrawalCad > 0 ? "−" + formatMoney(m.withdrawalCad).replace(/^-/, "") : "—"}
              </td>
              <td
                className={`num contrib-net ${mNetPos ? "pl-pos" : "pl-neg"}`}
                style={{ fontWeight: 400 }}
              >
                {m.contributionCad === 0 && m.withdrawalCad === 0
                  ? "—"
                  : formatMoney(m.contributionCad - m.withdrawalCad, { sign: true })}
              </td>
              <td />
            </tr>
          );
        })}
    </>
  );
}

export function ContributionView({ contributions }: { contributions: ContributionData }) {
  const [expanded, setExpanded] = useState<Set<number>>(
    new Set(contributions.years.slice(0, 1).map((y) => y.year))
  );

  const toggle = (year: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });

  const netPos = contributions.lifetimeNetCad >= 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="invest-header-row">
            <div className="page-title">Contribution</div>
            <PortfolioTabs active="contribution" />
          </div>
          <div className="page-sub">CASH FLOWS · NET DEPOSITS INTO BROKERAGE ACCOUNTS</div>
        </div>
        <div className="page-actions">
          <SnapTradeSyncButton />
          <SnapTradeLinkButton compact />
        </div>
      </div>

      <div className="summary-bar">
        <div className="cell">
          <div className="lbl">Net invested</div>
          <div className="val" style={{ color: netPos ? undefined : "var(--neg)" }}>
            {formatMoney(contributions.lifetimeNetCad)}
          </div>
        </div>
        <div className="cell">
          <div className="lbl">Total contributed</div>
          <div className="val">{formatMoney(contributions.lifetimeContributionCad)}</div>
        </div>
        <div className="cell">
          <div className="lbl">Total withdrawn</div>
          <div className="val">{formatMoney(contributions.lifetimeWithdrawalCad)}</div>
        </div>
      </div>

      {contributions.years.length > 0 && <ContributionChart contributions={contributions} />}

      {contributions.years.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="mkt-empty">
              No contribution history found. Sync your brokerage accounts to load cash flow data.
            </div>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">By year</div>
            <div className="panel-meta">CLICK A YEAR TO EXPAND MONTHS</div>
          </div>
          <div className="panel-body flush">
            <table className="table contrib-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Year</th>
                  <th className="num">Contributed</th>
                  <th className="num">Withdrawn</th>
                  <th className="num">Net</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {contributions.years.map((yr) => (
                  <YearRow
                    key={yr.year}
                    yr={yr}
                    expanded={expanded.has(yr.year)}
                    onToggle={() => toggle(yr.year)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="foot-note">
        <span>
          Contributions and withdrawals sourced from MoneyMovement entries in your brokerage ledger
        </span>
        <span>Amounts in CAD</span>
      </div>
    </>
  );
}
