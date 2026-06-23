"use client";

import { Lock, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { ValafiUsageSnapshot } from "@/lib/valafi/types";

import { riskColor } from "./format";
import styles from "./splc.module.scss";

/** Placeholder where a relationship-strength bar would be — hidden on free tier. */
export function ProChip({ label = "STRENGTH" }: { label?: string }) {
  return (
    <span className={styles.proChip} title="Relationship strength is a Vala-Fi Pro field">
      <Lock size={9} />
      {label} · PRO
    </span>
  );
}

export function RiskBadge({ level }: { level?: string | null }) {
  const text = (level ?? "—").toUpperCase();
  return (
    <span
      className={styles.riskBadge}
      style={{ color: riskColor(level), borderColor: riskColor(level) }}
    >
      {text}
    </span>
  );
}

export function EvidenceCard({ text }: { text: string }) {
  return <blockquote className={styles.evidence}>{text}</blockquote>;
}

export function NodeChip({
  ticker,
  name,
  color,
  active,
  onClick,
  title,
}: {
  ticker: string;
  name?: string | null;
  color?: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`${styles.nodeChip} ${active ? styles.nodeChipOn : ""}`}
      style={color ? { ["--chip" as string]: color } : undefined}
      onClick={onClick}
      title={title ?? (onClick ? `Explore ${ticker}` : undefined)}
    >
      <span className={styles.nodeChipTicker}>{ticker}</span>
      {name ? <span className={styles.nodeChipName}>{name}</span> : null}
    </Tag>
  );
}

/** Generic empty/blocked/disabled state shown in place of data. */
export function Note({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "warn" | "neg";
  children: ReactNode;
}) {
  return <div className={`${styles.note} ${styles[`note_${tone}`]}`}>{children}</div>;
}

/** Confirm-near-cap gate: shown when a live fetch would spend one of the last
 *  daily company slots. */
export function SpendConfirm({
  usage,
  onConfirm,
  busy,
  label = "Load anyway",
}: {
  usage: ValafiUsageSnapshot;
  onConfirm: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <div className={styles.spendGate}>
      <TriangleAlert size={14} className={styles.spendIcon} />
      <span>
        You&apos;ve used <strong>{usage.uniqueTickers}</strong>/{usage.tickerCap} companies today.
        Loading this one spends another slot.
      </span>
      <button type="button" className={styles.spendBtn} onClick={onConfirm} disabled={busy}>
        {busy ? "Loading…" : label}
      </button>
    </div>
  );
}
