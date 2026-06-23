// Server-only mapper: investment dashboard data → the lightweight holding
// view-model the pickers use. Pure (no DB/key), so it's safe to import from
// the server pages without leaking anything to the client bundle.

import type { InvestmentDashboardData } from "@/lib/investments/types";
import { isTrackable } from "@/lib/valafi/symbols";

import type { PickHolding } from "./types";

export function toPickHoldings(data: InvestmentDashboardData): PickHolding[] {
  const total = data.holdings.reduce((sum, h) => sum + (h.mvCAD || 0), 0) || 1;
  const byTicker = new Map<string, PickHolding>();

  for (const h of data.holdings) {
    const symbol = h.symbol.toUpperCase();
    const weightPct = (h.mvCAD / total) * 100;
    const existing = byTicker.get(symbol);
    if (existing) {
      existing.weightPct += weightPct;
    } else {
      byTicker.set(symbol, {
        symbol,
        name: h.description,
        weightPct,
        trackable: isTrackable(symbol, h.type),
      });
    }
  }

  return [...byTicker.values()].sort((a, b) => b.weightPct - a.weightPct);
}
