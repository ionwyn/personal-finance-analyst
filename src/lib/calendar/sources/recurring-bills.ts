// ─── Source: recurring bill due dates (Personal Finance) ────────────────────
// Projected from RecurringExpense. The model stores a day-of-month anchor only,
// so each active+confirmed bill is projected monthly on that day — the same
// derivation the pay-cycle view uses. Bills without an anchor are skipped.

import { monthlyOccurrences } from "@/lib/calendar/sources/projections";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { prisma } from "@/lib/prisma";

const num = (d: { toString(): string }) => Number(d.toString());

export const recurringBillsSource: CalendarSource = {
  id: "recurring-bills",
  category: "personal-finance",
  label: "Recurring bills",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const bills = await prisma.recurringExpense.findMany({
      where: { tenantId, active: true, confirmed: true },
      select: { id: true, name: true, amount: true, anchorDate: true, frequency: true },
    });

    const events: CalendarEvent[] = [];
    for (const bill of bills) {
      if (!bill.anchorDate) continue;
      for (const date of monthlyOccurrences(range, bill.anchorDate)) {
        events.push({
          id: `bill:${bill.id}:${date}`,
          date,
          category: "personal-finance",
          type: "bill",
          title: bill.name,
          amount: num(bill.amount),
          confidence: "confirmed",
          isPast: false,
          source: "Recurring expenses",
        });
      }
    }
    return events;
  },

  async listItems({ tenantId }) {
    const bills = await prisma.recurringExpense.findMany({
      where: { tenantId, active: true, confirmed: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return bills.map((b) => ({ key: `bill:${b.id}`, label: b.name }));
  },
};
