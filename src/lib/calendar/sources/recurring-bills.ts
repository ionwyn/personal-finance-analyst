// ─── Source: recurring bill due dates (Personal Finance) ────────────────────
// Projected from RecurringExpense by stepping `frequency` from `nextDueDate` —
// the same occurrence projection the pay-cycle reservation uses (so monthly,
// annual, and weekly/biweekly all land correctly). Bills without a nextDueDate
// are skipped.

import { fromISODate, toISODate } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { occurrencesInRange } from "@/lib/cycles/reservation";
import { prisma } from "@/lib/prisma";

const num = (d: { toString(): string }) => Number(d.toString());

export const recurringBillsSource: CalendarSource = {
  id: "recurring-bills",
  category: "personal-finance",
  label: "Recurring bills",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const bills = await prisma.recurringExpense.findMany({
      where: { tenantId, active: true, confirmed: true },
      select: { id: true, name: true, amount: true, nextDueDate: true, frequency: true },
    });

    const events: CalendarEvent[] = [];
    for (const bill of bills) {
      if (!bill.nextDueDate) continue;
      const occurrences = occurrencesInRange(
        { nextDueDate: bill.nextDueDate, frequency: bill.frequency },
        fromISODate(range.start),
        fromISODate(range.end)
      );
      for (const occ of occurrences) {
        const date = toISODate(occ);
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
