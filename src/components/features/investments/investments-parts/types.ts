import type { InvestmentConnection } from "@/lib/investments/types";

export type SortKey = "symbol" | "units" | "avgCost" | "price" | "mvCAD" | "plCAD" | "plPct";
export type SortDir = "asc" | "desc";

export type ConnectionPill = { cls: string; label: string };

export function connectionPill(connection: InvestmentConnection): ConnectionPill {
  switch (connection.status) {
    case "SYNCING":
      return { cls: "syncing", label: "SYNCING" };
    case "ERROR":
      return { cls: "error", label: "RE-AUTH" };
    case "DISABLED":
      return { cls: "error", label: "DISABLED" };
    default:
      return connection.isStale
        ? { cls: "warn", label: "STALE" }
        : { cls: "success", label: "HEALTHY" };
  }
}
