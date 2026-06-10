import type { ConnectionStatus, InvestmentConnection } from "@/lib/investments/types";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function dateDay(iso: string | null) {
  if (!iso) return "—";
  return String(new Date(iso).getUTCDate()).padStart(2, "0");
}

export function dateMonth(iso: string | null) {
  if (!iso) return "";
  return MONTH_NAMES[new Date(iso).getUTCMonth()] ?? "";
}

export function dateFull(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}, ${d.getUTCFullYear()}`;
}

export function worstConnectionStatus(connections: InvestmentConnection[]): ConnectionStatus {
  if (connections.some((c) => c.status === "ERROR")) return "ERROR";
  if (connections.some((c) => c.status === "SYNCING")) return "SYNCING";
  if (connections.some((c) => c.status === "DISABLED")) return "DISABLED";
  return "IDLE";
}

export function firstError(connections: InvestmentConnection[]) {
  return connections.find((c) => c.status === "ERROR") ?? null;
}

export function activeBrokerages(connections: InvestmentConnection[]) {
  return [...new Set(connections.map((c) => c.institution))].filter(Boolean);
}
