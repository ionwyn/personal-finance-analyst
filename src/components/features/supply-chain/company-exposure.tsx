"use client";

import { ShieldAlert } from "lucide-react";

import type { ValafiExposure } from "@/lib/valafi/types";

import { impactColor, relabelDependency, shortName } from "./format";
import { NodeChip, RiskBadge } from "./sc-primitives";
import styles from "./splc.module.scss";

export function hasExposure(e: ValafiExposure | null): boolean {
  if (!e) return false;
  return (
    (e.concentration_risks?.length ?? 0) > 0 ||
    (e.shared_suppliers?.length ?? 0) > 0 ||
    (e.shared_customers?.length ?? 0) > 0 ||
    e.exposure_score != null
  );
}

export function CompanyExposure({
  exposure,
  onSelect,
}: {
  exposure: ValafiExposure;
  onSelect?: (ticker: string) => void;
}) {
  const risks = exposure.concentration_risks ?? [];
  const sharedSup = exposure.shared_suppliers ?? [];
  const score = exposure.exposure_score;

  return (
    <div className={styles.exposure}>
      {score != null ? (
        <div className={styles.exposureScore}>
          <span className={`${styles.exposureScoreVal} mono`} style={{ color: impactColor(score) }}>
            {Math.round(score * 100)}
          </span>
          <span className={styles.exposureScoreLbl}>exposure score</span>
        </div>
      ) : null}

      <div className={styles.exposureMain}>
        {risks.length > 0 ? (
          <ul className={styles.riskList}>
            {risks.slice(0, 5).map((r, i) => (
              <li key={`${r.supplier?.ticker ?? i}`} className={styles.riskRow}>
                <ShieldAlert size={12} style={{ color: "var(--warn)" }} />
                <button
                  type="button"
                  className={styles.riskSupplier}
                  onClick={() => r.supplier?.ticker && onSelect?.(r.supplier.ticker)}
                  disabled={!onSelect || !r.supplier?.ticker}
                >
                  {r.supplier?.ticker ?? "—"}
                </button>
                <span className={styles.riskMeta}>
                  {relabelDependency(r.dependency_type)}
                  {r.alternatives_count != null ? ` · ${r.alternatives_count} alt` : ""}
                </span>
                <RiskBadge level={r.risk_level} />
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.listEmpty}>No single-source dependencies flagged.</div>
        )}

        {sharedSup.length > 0 ? (
          <div className={styles.exposurePeers}>
            <span className={styles.quickLabel}>Shares suppliers with peers</span>
            <div className={styles.compChips}>
              {sharedSup.slice(0, 6).map((s) => (
                <NodeChip
                  key={s.company.ticker}
                  ticker={s.company.ticker}
                  name={shortName(s.company.name, 16)}
                  onClick={onSelect ? () => onSelect(s.company.ticker) : undefined}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
