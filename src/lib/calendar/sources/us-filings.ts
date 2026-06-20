// ─── Source: US company filing dates (Filings) ──────────────────────────────
// Past only — there is no public forward filing schedule. Reads the existing
// EDGAR-backed MarketFiling cache (getFilings) for US-listed holdings; non-US
// symbols negative-cache to empty.

import { isWithinRange } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { loadInvestments } from "@/lib/investments/loader";
import { getFilings } from "@/lib/market-data/intel";

/** US-listed held symbols (traded in USD). */
async function usSymbols(tenantId: string): Promise<string[]> {
  const { holdings } = await loadInvestments(tenantId);
  return [
    ...new Set(
      holdings.filter((h) => h.currency === "USD" && h.symbol).map((h) => h.symbol)
    ),
  ];
}

export const usFilingsSource: CalendarSource = {
  id: "us-filings",
  category: "filings",
  label: "US filings",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const symbols = await usSymbols(tenantId);
    if (symbols.length === 0) return [];

    const perSymbol = await Promise.all(
      symbols.map(async (symbol) => {
        const filings = await getFilings(symbol).catch(() => []);
        return filings
          .filter((f) => isWithinRange(f.filedAt, range.start, range.end))
          .map<CalendarEvent>((f) => ({
            id: `filing:${symbol}:${f.accession}`,
            date: f.filedAt,
            category: "filings",
            type: "filing",
            title: `${f.form} · ${symbol}`,
            subtitle: f.title ?? undefined,
            symbol,
            confidence: "confirmed",
            isPast: false,
            source: "SEC EDGAR",
          }));
      })
    );

    return perSymbol.flat();
  },

  async listItems({ tenantId }) {
    const symbols = await usSymbols(tenantId);
    return symbols.sort().map((s) => ({ key: `filing:${s}`, label: s }));
  },
};
