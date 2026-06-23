"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ChangeFeedPanel } from "./change-feed-panel";
import { PortfolioExposurePanel } from "./portfolio-exposure-panel";
import type { PickHolding } from "./types";
import styles from "./splc.module.scss";

export function OverviewView({
  registered,
  holdings,
}: {
  registered: boolean;
  holdings: PickHolding[];
}) {
  const tracked = holdings.filter((h) => h.trackable);

  return (
    <div className={styles.overview}>
      {tracked.length > 0 ? (
        <div className={styles.launchStrip}>
          <span className={styles.quickLabel}>Map a holding</span>
          {tracked.slice(0, 12).map((h) => (
            <Link
              key={h.symbol}
              href={`/app/supply-chain/explorer?ticker=${encodeURIComponent(h.symbol)}` as never}
              className={styles.launchChip}
              title={`${h.name} · ${h.weightPct.toFixed(1)}%`}
            >
              {h.symbol}
              <ArrowUpRight size={11} />
            </Link>
          ))}
        </div>
      ) : null}

      <div className={styles.overviewGrid}>
        <PortfolioExposurePanel registered={registered} />
        <ChangeFeedPanel registered={registered} />
      </div>
    </div>
  );
}
