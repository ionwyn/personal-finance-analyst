// ─── Source: paycheck arrivals (Personal Finance) ──────────────────────────
// Projected from UserSettings: lastPaycheckDate stepped by payFrequencyDays.
// App-owned, zero external calls.

import { toISODate } from "@/lib/calendar/dates";
import { cadenceOccurrences } from "@/lib/calendar/sources/projections";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { prisma } from "@/lib/prisma";

export const paychecksSource: CalendarSource = {
  id: "paychecks",
  category: "personal-finance",
  label: "Paychecks",

  async getEvents({ tenantId, range }): Promise<CalendarEvent[]> {
    const settings = await prisma.userSettings.findUnique({
      where: { tenantId },
      select: { lastPaycheckDate: true, payFrequencyDays: true },
    });
    if (!settings?.lastPaycheckDate || !settings.payFrequencyDays) return [];

    const anchorISO = toISODate(settings.lastPaycheckDate);
    return cadenceOccurrences(range, anchorISO, settings.payFrequencyDays).map((date) => ({
      id: `paycheck:${date}`,
      date,
      category: "personal-finance",
      type: "paycheck",
      title: "Payday",
      confidence: "confirmed",
      isPast: false,
      source: "Pay cycle",
    }));
  },

  async listItems() {
    return [{ key: "paycheck", label: "Paychecks" }];
  },
};
