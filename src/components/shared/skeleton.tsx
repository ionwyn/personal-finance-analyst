// Skeleton loaders — streaming placeholders rendered while data resolves.
//
// Server-safe (no hooks / no "use client"): these render both inside route-level
// `loading.tsx` files and as `next/dynamic` fallbacks. Styling lives in
// `src/styles/_skeleton.scss` (global classes, mirroring the `.panel` system so
// skeletons line up pixel-for-pixel with the real components they stand in for).
//
// Aesthetic: neutral grays only (no amber), a quiet surface-2 → surface-3 shimmer
// sweep, sharp radius — Bloomberg-meets-Linear. Honors `prefers-reduced-motion`.

import type { CSSProperties, ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type BlockProps = {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
};

/** A single shimmering line — text, label, or any inline placeholder. */
export function SkeletonLine({ width, height, className, style }: BlockProps) {
  return (
    <span
      className={cx("sk", "sk-line", className)}
      style={{ width, height, ...style }}
      aria-hidden
    />
  );
}

/** A stack of lines; the last line is shortened to read as a paragraph. */
export function SkeletonText({ lines = 3, gap }: { lines?: number; gap?: number }) {
  return (
    <div className="sk-text" style={gap ? { gap } : undefined} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? "55%" : "100%"} />
      ))}
    </div>
  );
}

/** Tall block sized to stand in for a KPI `BigNumber` (kpi-value, 26px). */
export function SkeletonNumber({
  width,
  className,
}: {
  width?: number | string;
  className?: string;
}) {
  return (
    <span
      className={cx("sk", "sk-number", className)}
      style={width ? { width } : undefined}
      aria-hidden
    />
  );
}

// Deterministic bar heights — must be stable across SSR/CSR to avoid hydration
// mismatch, so no Math.random(). A fixed jagged pattern reads as "a chart".
const BAR_SEED = [62, 48, 70, 38, 84, 30, 66, 52, 78, 44, 58, 72, 40, 88, 34, 64];
function barHeights(n: number): number[] {
  return Array.from({ length: n }, (_, i) => BAR_SEED[i % BAR_SEED.length]);
}

/**
 * Chart placeholder. `area` is a clipped silhouette, `bar` a row of columns,
 * `donut` a masked ring (120px, matching CategoryDonut). Fills its parent's
 * height by default — give the parent a fixed height to prevent layout shift.
 */
export function SkeletonChart({
  variant = "bar",
  height = "100%",
  bars = 12,
}: {
  variant?: "area" | "bar" | "donut";
  height?: number | string;
  bars?: number;
}) {
  if (variant === "donut") {
    return <div className="sk sk-chart--donut" aria-hidden />;
  }
  if (variant === "area") {
    return <div className="sk sk-chart--area" style={{ height }} aria-hidden />;
  }
  return (
    <div className="sk-chart sk-chart--bar" style={{ height }} aria-hidden>
      {barHeights(bars).map((h, i) => (
        <span key={i} className="sk sk-bar" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** One table row — a grid of cells. Pass `gridTemplate` to mirror a real table. */
export function SkeletonRow({ cols = 4, gridTemplate }: { cols?: number; gridTemplate?: string }) {
  return (
    <div
      className="sk-row"
      style={{ gridTemplateColumns: gridTemplate ?? `repeat(${cols}, 1fr)` }}
      aria-hidden
    >
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLine key={i} width={i === 0 ? "70%" : i === cols - 1 ? "45%" : "82%"} />
      ))}
    </div>
  );
}

/** A stack of table rows. */
export function SkeletonTable({
  rows = 6,
  cols = 4,
  gridTemplate,
}: {
  rows?: number;
  cols?: number;
  gridTemplate?: string;
}) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} gridTemplate={gridTemplate} />
      ))}
    </div>
  );
}

/**
 * Panel-shaped wrapper reusing the real `.panel` classes, so a skeleton panel
 * occupies the same footprint as the loaded panel. `aria-busy` marks the region
 * as loading for assistive tech.
 */
export function SkeletonPanel({
  title = true,
  children,
  bodyStyle,
  bodyClassName,
}: {
  title?: boolean;
  children?: ReactNode;
  bodyStyle?: CSSProperties;
  bodyClassName?: string;
}) {
  return (
    <div className="panel" aria-busy="true">
      {title ? (
        <div className="panel-head">
          <SkeletonLine width={120} height={11} />
          <SkeletonLine width={48} height={11} />
        </div>
      ) : null}
      <div className={cx("panel-body", bodyClassName)} style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}

/** Convenience: a panel whose body is a single chart — the common chart fallback. */
export function SkeletonChartPanel({
  variant = "area",
  height = 220,
  title = true,
}: {
  variant?: "area" | "bar" | "donut";
  height?: number;
  title?: boolean;
}) {
  return (
    <SkeletonPanel title={title} bodyStyle={{ height }}>
      <SkeletonChart variant={variant} />
    </SkeletonPanel>
  );
}

/** Page-header placeholder — mirrors the global `.page-header` (title + sub + actions). */
export function PageHeaderSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <div className="page-header" aria-busy="true">
      <div>
        <SkeletonLine width={140} height={18} />
        <SkeletonLine width={260} height={11} style={{ marginTop: 10 }} />
      </div>
      {actions ? (
        <div className="page-actions">
          <SkeletonLine width={96} height={28} />
        </div>
      ) : null}
    </div>
  );
}

/** KPI strip placeholder — mirrors the global `.kpi-grid` (N `.kpi` cells). */
export function KpiStripSkeleton({ cells = 4 }: { cells?: number }) {
  return (
    <div className="kpi-grid" aria-busy="true">
      {Array.from({ length: cells }).map((_, i) => (
        <div className="kpi" key={i}>
          <SkeletonLine width={72} height={10} style={{ marginBottom: 12 }} />
          <SkeletonNumber width="64%" />
          <SkeletonLine width={96} height={11} style={{ marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}
