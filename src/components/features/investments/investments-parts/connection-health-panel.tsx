import Link from "next/link";

import { InstitutionLogo } from "@/components/shared/institution-logo";
import { formatRelativeTime } from "@/lib/format";
import type { InvestmentConnection } from "@/lib/investments/types";

import { connectionPill } from "./types";

export function ConnectionHealthPanel({ connections }: { connections: InvestmentConnection[] }) {
  if (connections.length === 0) return null;
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <div className="panel-title">Connection health</div>
        <div className="panel-meta">
          {connections.length} {connections.length === 1 ? "CONNECTION" : "CONNECTIONS"}
        </div>
      </div>
      <div className="panel-body flush">
        <div className="conn-list">
          {connections.map((c) => {
            const pill = connectionPill(c);
            return (
              <div className="conn-row" key={c.id}>
                <InstitutionLogo
                  name={c.institution}
                  logo={c.institutionLogo}
                  bg={c.institutionLogoBg}
                  size={28}
                  radius={5}
                />
                <div>
                  <div className="nm">{c.institution}</div>
                  <div className="meta">
                    {c.accountCount} {c.accountCount === 1 ? "account" : "accounts"}
                  </div>
                  {c.status === "ERROR" && (c.errorMessage || c.errorCode) ? (
                    <div className="sub-err">
                      {c.errorCode ? `${c.errorCode}: ` : ""}
                      {c.errorMessage ?? "Reconnect required."}
                    </div>
                  ) : null}
                  {c.status !== "ERROR" && c.initialSyncIncompleteCount > 0 ? (
                    <div className="sub-info">
                      {c.initialSyncIncompleteCount}{" "}
                      {c.initialSyncIncompleteCount === 1 ? "account" : "accounts"} still completing
                      initial sync
                    </div>
                  ) : null}
                </div>
                <span className={`status ${pill.cls}`}>
                  <i className="pulse" />
                  {pill.label}
                </span>
                <span className="meta">
                  {c.lastSyncAt ? `Synced ${formatRelativeTime(c.lastSyncAt)}` : "Never synced"}
                </span>
                <Link href="/app/settings?s=connections" className="conn-link">
                  VIEW DETAIL →
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
