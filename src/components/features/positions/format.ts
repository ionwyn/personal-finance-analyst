import { formatMoney, formatPercent } from "@/lib/format";

export const money = (n: number) => formatMoney(Math.abs(n));
export const signMoney = (n: number) => formatMoney(n, { sign: true });
export const pct = (n: number) => formatPercent(n);
export const dash = (v: string | null | undefined) => (v == null ? "—" : v);

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export const SECTIONS: [string, string][] = [
  ["overview", "Overview"],
  ["performance", "Performance"],
  ["ownership", "Ownership"],
  ["activity", "Activity"],
  ["exposure", "Exposure"],
  ["fundamentals", "Fundamentals"],
  ["intel", "Street"],
  ["technicals", "Technicals"],
  ["news", "News"],
  ["decision", "Cases"],
  ["supply-chain", "Supply Chain"],
];
