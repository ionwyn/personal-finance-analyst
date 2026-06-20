// ─── Source: earnings & dividend dates (Investments) ────────────────────────
// Per-held-symbol forward dates from the existing MarketEvents cache, which is
// already cache-while-fresh (getEventsForSymbols). Cache is king: we only ask
// for symbols currently held, and ETFs/most non-US names negative-cache to null.

import { isWithinRange } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { loadInvestments } from "@/lib/investments/loader";
import { getMarketDataService } from "@/lib/market-data";

/** Distinct held symbols (ticker form, e.g. "VFV.TO", "AAPL"). */
async function heldSymbols(tenantId: string): Promise<string[]> {
  const { holdings } = await loadInvestments(tenantId);
  return [...new Set(holdings.map((h) => h.symbol).filter(Boolean))];
}

function dayOf(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

export const earningsDividendsSource: CalendarSource = {
  id: "earnings-dividends",
  category: "investments",
  label: "Earnings & dividends",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const symbols = await heldSymbols(tenantId);
    if (symbols.length === 0) return [];

    const events = await getMarketDataService().getEventsForSymbols(symbols);
    const out: CalendarEvent[] = [];

    events.forEach((ev, i) => {
      if (!ev) return;
      const symbol = symbols[i]!;
      const push = (
        kind: "earnings" | "exdiv" | "divpay",
        type: string,
        title: string,
        iso: string | null
      ) => {
        const date = dayOf(iso);
        if (!date || !isWithinRange(date, range.start, range.end)) return;
        out.push({
          id: `inv:${symbol}:${kind}:${date}`,
          date,
          category: "investments",
          type,
          title,
          symbol,
          confidence: "estimated",
          isPast: false,
          source: "Market data (Yahoo)",
        });
      };
      push("earnings", "earnings", `${symbol} · earnings`, ev.nextEarnings);
      push("exdiv", "ex-dividend", `${symbol} · ex-dividend`, ev.exDividend);
      push("divpay", "dividend-payment", `${symbol} · dividend paid`, ev.dividendDate);
    });

    return out;
  },

  async listItems({ tenantId }) {
    const symbols = await heldSymbols(tenantId);
    return symbols.sort().map((s) => ({ key: `inv:${s}`, label: s }));
  },
};
