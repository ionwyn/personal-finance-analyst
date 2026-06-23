"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import type { ValafiUsageSnapshot } from "@/lib/valafi/types";

import { fetchUsage } from "./api";
import { subscribeUsage } from "./usage-bus";
import styles from "./splc.module.scss";

function gaugeColor(used: number, cap: number, warnAt: number): string {
  const ratio = cap > 0 ? used / cap : 0;
  if (used >= cap) return "var(--neg)";
  if (used >= warnAt) return "var(--warn)";
  if (ratio >= 0.6) return "var(--accent)";
  return "var(--pos)";
}

function Gauge({
  label,
  used,
  cap,
  warnAt,
}: {
  label: string;
  used: number;
  cap: number;
  warnAt: number;
}) {
  const color = gaugeColor(used, cap, warnAt);
  const ratio = cap > 0 ? Math.min(1, used / cap) : 0;
  return (
    <div className={styles.gauge}>
      <div className={styles.gaugeTop}>
        <span className={styles.gaugeLabel}>{label}</span>
        <span className={`${styles.gaugeValue} mono`} style={{ color }}>
          {used}
          <span className={styles.gaugeCap}>/{cap}</span>
        </span>
      </div>
      <div className={styles.gaugeTrack}>
        <div className={styles.gaugeFill} style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export function QuotaMeter({ initial }: { initial?: ValafiUsageSnapshot }) {
  const [usage, setUsage] = useState<ValafiUsageSnapshot | null>(initial ?? null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!initial)
      fetchUsage()
        .then((r) => alive && setUsage(r.usage))
        .catch(() => {});
    const unsub = subscribeUsage((u) => alive && setUsage(u));
    const id = window.setInterval(() => {
      fetchUsage()
        .then((r) => alive && setUsage(r.usage))
        .catch(() => {});
    }, 30_000);
    return () => {
      alive = false;
      unsub();
      window.clearInterval(id);
    };
  }, [initial]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await fetchUsage(true);
      setUsage(r.usage);
    } catch {
      // keep last known
    } finally {
      setRefreshing(false);
    }
  };

  if (usage?.source === "disabled") {
    return <div className={styles.meterDisabled}>VALAFI_API_KEY not set · cached only</div>;
  }
  if (!usage) return <div className={styles.meterDisabled}>Loading quota…</div>;

  const companiesLeft = Math.max(0, usage.tickerCap - usage.uniqueTickers);

  return (
    <div className={styles.meter}>
      <Gauge
        label="REQ TODAY"
        used={usage.requests}
        cap={usage.requestCap}
        warnAt={usage.requestCap - 4}
      />
      <Gauge
        label="COMPANIES"
        used={usage.uniqueTickers}
        cap={usage.tickerCap}
        warnAt={usage.confirmThreshold}
      />
      <span className={styles.meterHint}>
        {companiesLeft > 0 ? `${companiesLeft} new today` : "cached only"}
      </span>
      <button
        type="button"
        className={styles.meterRefresh}
        onClick={refresh}
        disabled={refreshing}
        title="Reconcile with Vala-Fi /dev/usage (1 request)"
        aria-label="Refresh quota"
      >
        <RefreshCw size={11} className={refreshing ? styles.spin : undefined} />
      </button>
    </div>
  );
}
