"use client";

import { useState } from "react";
import { Activity, Play } from "lucide-react";

import type { ValafiImpact } from "@/lib/valafi/types";

import { fetchImpact } from "./api";
import { impactColor, severityLabel, shortName } from "./format";
import { Note, SpendConfirm } from "./sc-primitives";
import { publishUsage } from "./usage-bus";
import styles from "./splc.module.scss";

export function ImpactSimulator({
  ticker,
  onSelect,
}: {
  ticker: string;
  onSelect?: (ticker: string) => void;
}) {
  const [severity, setSeverity] = useState(0.8);
  const [maxHops, setMaxHops] = useState(2);
  const [impact, setImpact] = useState<ValafiImpact | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastUsage, setLastUsage] = useState<Parameters<typeof SpendConfirm>[0]["usage"] | null>(
    null
  );

  const run = async (confirm = false) => {
    setBusy(true);
    setNeedsConfirm(false);
    try {
      const res = await fetchImpact(ticker, { severity, maxHops, confirm });
      publishUsage(res.usage);
      setLastUsage(res.usage);
      setStatus(res.status);
      if (res.needsConfirm) {
        setNeedsConfirm(true);
      } else if (res.data) {
        setImpact(res.data);
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const impacted = [...(impact?.impacted_companies ?? [])].sort(
    (a, b) => (b.impact_score ?? 0) - (a.impact_score ?? 0)
  );

  return (
    <div className={styles.impactWrap}>
      <div className={styles.impactControls}>
        <label className={styles.impactField}>
          <span>
            Severity · <strong>{severityLabel(severity)}</strong> {Math.round(severity * 100)}%
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className={styles.slider}
          />
        </label>
        <label className={styles.impactField}>
          <span>
            Propagation · {maxHops} hop{maxHops > 1 ? "s" : ""}
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={maxHops}
            onChange={(e) => setMaxHops(Number(e.target.value))}
            className={styles.slider}
          />
        </label>
        <button type="button" className={styles.runBtn} onClick={() => run(false)} disabled={busy}>
          <Play size={12} />
          {busy ? "Running…" : "Run cascade"}
        </button>
      </div>

      {needsConfirm && lastUsage ? (
        <SpendConfirm
          usage={lastUsage}
          onConfirm={() => run(true)}
          busy={busy}
          label="Run anyway"
        />
      ) : null}

      {status === "empty" ? <Note>No cascade data for {ticker}.</Note> : null}
      {status === "blocked" && !needsConfirm ? (
        <Note tone="warn">Daily request budget reached — try again tomorrow.</Note>
      ) : null}
      {status === "disabled" ? <Note>Set VALAFI_API_KEY to run simulations.</Note> : null}

      {impact && impacted.length > 0 ? (
        <>
          <div className={styles.impactSummary}>
            <Activity size={13} />
            <span>
              <strong>{impact.total_impacted ?? impacted.length}</strong> companies impacted
              {impact.sectors_affected?.length
                ? ` · ${impact.sectors_affected.slice(0, 3).join(", ")}`
                : ""}
            </span>
          </div>
          <ul className={styles.cascadeList}>
            {impacted.slice(0, 8).map((c) => {
              const score = c.impact_score ?? 0;
              return (
                <li key={c.company.ticker} className={styles.cascadeRow}>
                  <button
                    type="button"
                    className={styles.cascadeTicker}
                    onClick={() => onSelect?.(c.company.ticker)}
                    disabled={!onSelect}
                  >
                    {c.company.ticker}
                  </button>
                  <span className={styles.cascadeName}>{shortName(c.company.name, 28)}</span>
                  <div className={styles.cascadeBarTrack}>
                    <div
                      className={styles.cascadeBarFill}
                      style={{
                        width: `${Math.min(100, score * 100)}%`,
                        background: impactColor(score),
                      }}
                    />
                  </div>
                  <span
                    className={`${styles.cascadeScore} mono`}
                    style={{ color: impactColor(score) }}
                  >
                    {Math.round(score * 100)}
                  </span>
                  {c.hops_from_source != null ? (
                    <span className={styles.hop}>{c.hops_from_source}h</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
