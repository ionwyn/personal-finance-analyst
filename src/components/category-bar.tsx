"use client";

import { ChevronRight } from "lucide-react";

import { formatMoney } from "@/components/big-number";

export type CategoryBarProps = {
  label: string;
  color: string;
  amount: number;
  pct: number;
  delta?: number | null;
  prevAmount?: number;
  prevPct?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  size?: "md" | "sm";
};

export function CategoryBar({
  label,
  color,
  amount,
  pct,
  delta = null,
  prevAmount,
  prevPct,
  expandable = false,
  expanded = false,
  onToggle,
  size = "md",
}: CategoryBarProps) {
  const labelFontSize = size === "sm" ? 11 : 12;
  const trackHeight = size === "sm" ? 3 : 4;
  const showShadow = typeof prevAmount === "number" && typeof prevPct === "number";
  const interactive = expandable && onToggle != null;

  const Header = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: labelFontSize,
        marginBottom: 3,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {expandable ? (
          <ChevronRight
            size={10}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
              color: "var(--text-3)",
            }}
          />
        ) : null}
        <i
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
        {label}
      </span>
      <span
        className="mono"
        style={{ fontVariantNumeric: "tabular-nums", display: "flex", gap: 8 }}
      >
        <span>{formatMoney(amount)}</span>
        {delta !== null && delta !== undefined ? (
          <span
            style={{
              fontSize: 10,
              color: delta > 0 ? "var(--neg)" : "var(--pos)",
              width: 56,
              textAlign: "right",
            }}
          >
            {delta > 0 ? "+" : ""}
            {formatMoney(delta, { sign: false })}
          </span>
        ) : (
          <span style={{ width: 56 }} />
        )}
      </span>
    </div>
  );

  const Track = (
    <div
      style={{
        position: "relative",
        height: trackHeight,
        background: "var(--surface-2)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {showShadow ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${Math.max(0, Math.min(100, prevPct ?? 0))}%`,
            background: color,
            opacity: 0.25,
          }}
        />
      ) : null}
      <div
        style={{
          position: "relative",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: "100%",
          background: color,
        }}
      />
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          all: "unset",
          display: "block",
          width: "100%",
          cursor: "pointer",
        }}
      >
        {Header}
        {Track}
      </button>
    );
  }

  return (
    <div>
      {Header}
      {Track}
    </div>
  );
}
