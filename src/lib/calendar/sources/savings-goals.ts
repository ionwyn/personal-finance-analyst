// ─── Source: savings goal target dates (Personal Finance) ───────────────────
// One event per active goal that has a targetDate inside the window.

import { toISODate } from "@/lib/calendar/dates";
import { isWithinRange } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { prisma } from "@/lib/prisma";

const num = (d: { toString(): string }) => Number(d.toString());

export const savingsGoalsSource: CalendarSource = {
  id: "savings-goals",
  category: "personal-finance",
  label: "Savings goals",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const goals = await prisma.savingsGoal.findMany({
      where: { tenantId, active: true, targetDate: { not: null } },
      select: { id: true, name: true, targetAmount: true, targetDate: true },
    });

    const events: CalendarEvent[] = [];
    for (const goal of goals) {
      if (!goal.targetDate) continue;
      const date = toISODate(goal.targetDate);
      if (!isWithinRange(date, range.start, range.end)) continue;
      events.push({
        id: `savings-goal:${goal.id}`,
        date,
        category: "personal-finance",
        type: "savings-goal-target",
        title: `${goal.name} · target`,
        amount: num(goal.targetAmount),
        confidence: "confirmed",
        isPast: false,
        source: "Savings goals",
      });
    }
    return events;
  },

  async listItems({ tenantId }) {
    const goals = await prisma.savingsGoal.findMany({
      where: { tenantId, active: true, targetDate: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return goals.map((g) => ({ key: `savings-goal:${g.id}`, label: g.name }));
  },
};
