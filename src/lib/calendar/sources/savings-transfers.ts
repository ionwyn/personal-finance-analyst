// ─── Source: savings transfer dates (Personal Finance) ──────────────────────
// Past only: classified savings transactions (txnType="savings"). The savings
// destinations model stores match patterns, not a cadence, so there is nothing
// to project forward — we surface transfers that actually happened.

import { fromISODate, toISODate } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { prisma } from "@/lib/prisma";

const num = (d: { toString(): string }) => Number(d.toString());

export const savingsTransfersSource: CalendarSource = {
  id: "savings-transfers",
  category: "personal-finance",
  label: "Savings transfers",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const txns = await prisma.plaidTransaction.findMany({
      where: {
        tenantId,
        txnType: "savings",
        removed: false,
        supersededById: null,
        date: { gte: fromISODate(range.start), lte: fromISODate(range.end) },
      },
      select: { id: true, name: true, merchantName: true, amount: true, date: true },
    });

    return txns.map((t) => ({
      id: `savings-transfer:${t.id}`,
      date: toISODate(t.date),
      category: "personal-finance" as const,
      type: "savings-transfer",
      title: t.merchantName ?? t.name,
      amount: num(t.amount),
      confidence: "confirmed" as const,
      isPast: false,
      source: "Savings transfers",
    }));
  },

  async listItems() {
    return [{ key: "savings-transfer", label: "Savings transfers" }];
  },
};
