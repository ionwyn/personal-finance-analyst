// Presentational helpers shared across the supply-chain components.

import type { ValafiCompany, ValafiEdge } from "@/lib/valafi/types";

/** The endpoint of an edge that isn't the centred company. */
export function counterpart(
  edge: ValafiEdge,
  center: string
): Partial<ValafiCompany> & { ticker: string } {
  return edge.target?.ticker?.toUpperCase() === center.toUpperCase() ? edge.source : edge.target;
}

export function riskColor(level?: string | null): string {
  switch ((level ?? "").toLowerCase()) {
    case "high":
      return "var(--neg)";
    case "medium":
      return "var(--warn)";
    case "low":
      return "var(--pos)";
    default:
      return "var(--text-3)";
  }
}

/** Colour per relationship type — used for edges, chips and column accents. */
export function relColor(type?: string): string {
  switch ((type ?? "").toLowerCase()) {
    case "supplier":
      return "var(--info)";
    case "customer":
      return "var(--invest)";
    case "competitor":
      return "var(--warn)";
    default:
      return "var(--text-3)";
  }
}

export function severityLabel(severity: number): string {
  if (severity >= 0.85) return "Severe";
  if (severity >= 0.6) return "Major";
  if (severity >= 0.35) return "Moderate";
  return "Mild";
}

export function impactColor(score?: number | null): string {
  if (score == null) return "var(--text-3)";
  if (score >= 0.66) return "var(--neg)";
  if (score >= 0.33) return "var(--warn)";
  return "var(--pos)";
}

export function pct(n?: number | null): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

export function shortName(name?: string | null, max = 24): string {
  if (!name) return "";
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function relabelDependency(type?: string): string {
  switch ((type ?? "").toLowerCase()) {
    case "sole_supplier":
      return "Single source";
    case "key_supplier":
      return "Key supplier";
    default:
      return type ? type.replace(/_/g, " ") : "Dependency";
  }
}
