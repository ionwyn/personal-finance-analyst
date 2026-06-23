"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, GitCompareArrows } from "lucide-react";

import { Panel } from "@/components/ui";
import type { ValafiChangeEvent, ValafiPortfolioAlert } from "@/lib/valafi/types";

import { fetchAlerts, fetchChanges } from "./api";
import { Note, RiskBadge } from "./sc-primitives";
import { publishUsage } from "./usage-bus";
import styles from "./splc.module.scss";

const explorerHref = (t: string) => `/app/supply-chain/explorer?ticker=${encodeURIComponent(t)}`;

function eventLine(e: ValafiChangeEvent): string {
  const src = e.source_ticker ?? e.holding_ticker ?? "";
  const tgt = e.target_ticker ?? "";
  const verb =
    e.event_type === "removed_relationship" ? "✕" : e.event_type === "strength_change" ? "≈" : "→";
  const rel = e.relationship_type ? ` · ${e.relationship_type}` : "";
  return `${src} ${verb} ${tgt}${rel}`.trim();
}

export function ChangeFeedPanel({ registered }: { registered: boolean }) {
  const [alerts, setAlerts] = useState<ValafiPortfolioAlert[] | null>(null);
  const [changes, setChanges] = useState<ValafiChangeEvent[] | null>(null);
  const [loading, setLoading] = useState(registered);

  useEffect(() => {
    if (!registered) return;
    let alive = true;
    Promise.all([fetchAlerts(), fetchChanges()])
      .then(([a, c]) => {
        if (!alive) return;
        publishUsage(a.usage);
        publishUsage(c.usage);
        setAlerts(Array.isArray(a.data) ? a.data : []);
        setChanges(c.data?.events ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [registered]);

  if (!registered) {
    return (
      <Panel title="Supply-chain alerts" meta="not enabled">
        <Note>Enable portfolio monitoring to track new and removed supplier relationships.</Note>
      </Panel>
    );
  }

  const alertList = alerts ?? [];
  const changeList = changes ?? [];

  return (
    <Panel title="Supply-chain alerts" meta={`${alertList.length} active`}>
      {loading && !alerts ? <div className={styles.loading}>Loading alerts…</div> : null}

      {alertList.length > 0 ? (
        <ul className={styles.alertList}>
          {alertList.slice(0, 6).map((a, i) => (
            <li key={i} className={styles.alertRow}>
              <Bell size={12} className={styles.alertIcon} />
              {a.holding ? (
                <Link href={explorerHref(a.holding) as never} className={styles.alertHolding}>
                  {a.holding}
                </Link>
              ) : null}
              <span className={styles.alertDesc}>{a.description}</span>
              <RiskBadge level={a.severity} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.subhead}>
        <GitCompareArrows size={12} /> Recent relationship changes
      </div>
      {changeList.length === 0 ? (
        <div className={styles.listEmpty}>
          {loading ? "…" : "No relationship changes detected across your holdings."}
        </div>
      ) : (
        <ul className={styles.changeList}>
          {changeList.slice(0, 10).map((e, i) => (
            <li key={i} className={styles.changeRow}>
              <span className={`${styles.changeLine} mono`}>{eventLine(e)}</span>
              {e.filing_date ? <span className={styles.changeDate}>{e.filing_date}</span> : null}
              <RiskBadge level={e.severity} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
