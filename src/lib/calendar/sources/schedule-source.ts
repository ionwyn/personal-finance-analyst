// ─── Generic source adapter for a hand-maintained FixedSchedule ─────────────
// Turns a config schedule (FOMC / BoC / StatCan) into a CalendarSource: filters
// its events to the window and exposes its items for the settings UI. Used so
// the three config-macro sources are pure data, not bespoke code.

import { isWithinRange } from "@/lib/calendar/dates";
import type { FixedSchedule } from "@/lib/calendar/rules/schedules";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";

export function scheduleSource(schedule: FixedSchedule): CalendarSource {
  return {
    id: schedule.id,
    category: schedule.category,
    label: schedule.label,
    confirmedThrough: schedule.confirmedThrough,

    async getEvents({ range }): Promise<CalendarEvent[]> {
      return schedule.events
        .filter((e) => isWithinRange(e.date, range.start, range.end))
        .map((e) => ({
          id: `${e.itemKey}:${e.date}`,
          date: e.date,
          category: schedule.category,
          type: e.type,
          title: e.title,
          confidence: e.confidence,
          isPast: false,
          source: schedule.attribution,
        }));
    },

    async listItems() {
      return schedule.items;
    },
  };
}
