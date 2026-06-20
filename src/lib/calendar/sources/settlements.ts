// ─── Source: brokerage settlement dates (Personal Finance) ──────────────────
// Cash/security settlement actuals from the broker ledger. These are recorded
// settlement dates (past, plus any T+1 forward already captured on recent
// trades) — the settlement *patterns* in settings are transaction classifiers,
// not a T+N rule, so we surface actuals rather than projecting.

import { fromISODate, toISODate } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { prisma } from "@/lib/prisma";

const num = (d: { toString(): string } | null) => (d == null ? undefined : Number(d.toString()));

export const settlementsSource: CalendarSource = {
  id: "settlements",
  category: "personal-finance",
  label: "Brokerage settlements",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const entries = await prisma.brokerLedgerEntry.findMany({
      where: {
        tenantId,
        settlementDate: { gte: fromISODate(range.start), lte: fromISODate(range.end) },
      },
      select: {
        id: true,
        settlementDate: true,
        activityType: true,
        symbol: true,
        cashAmount: true,
        currency: true,
      },
    });

    const events: CalendarEvent[] = [];
    for (const e of entries) {
      if (!e.settlementDate) continue;
      const date = toISODate(e.settlementDate);
      const title = e.symbol ? `${e.activityType} · ${e.symbol}` : e.activityType;
      events.push({
        id: `settlement:${e.id}`,
        date,
        category: "personal-finance",
        type: "settlement",
        title,
        symbol: e.symbol ?? undefined,
        amount: num(e.cashAmount),
        currency: e.currency ?? undefined,
        confidence: "confirmed",
        isPast: false,
        source: "Brokerage settlements",
      });
    }
    return events;
  },

  async listItems() {
    // Per-entry hiding would be noise; expose a single group toggle.
    return [{ key: "settlement", label: "Brokerage settlements" }];
  },
};
