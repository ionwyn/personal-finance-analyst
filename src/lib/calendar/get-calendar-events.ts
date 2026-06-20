// ─── Calendar aggregation loader ────────────────────────────────────────────
// Runs every enabled source over the fixed window, applies the tenant's
// preferences (disabled categories + hidden item keys), and returns a
// serializable, day-grouped structure for the client. The page loads the whole
// window once; month navigation is pure client state.

import { startOfUtcDay, toISODate } from "@/lib/calendar/dates";
import { isHidden } from "@/lib/calendar/hidden";
import { CALENDAR_SOURCES } from "@/lib/calendar/sources/registry";
import {
  CALENDAR_CATEGORIES,
  type CalendarCategory,
  type CalendarEvent,
  type CalendarRange,
} from "@/lib/calendar/types";
import { getCalendarWindow, getNavigableMonths } from "@/lib/calendar/window";
import { prisma } from "@/lib/prisma";

export type CalendarData = {
  window: CalendarRange;
  navigable: { min: string; max: string; current: string };
  todayISO: string;
  /** Events grouped by YYYY-MM-DD, each list pre-sorted by source order. */
  eventsByDay: Record<string, CalendarEvent[]>;
  /** Post-filter event counts per category, for the on-page filter. */
  counts: Record<CalendarCategory, number>;
  disabledCategories: CalendarCategory[];
  /** Earliest "schedule confirmed through" across enabled config sources. */
  confirmedThrough: string | null;
};

export async function getCalendarEvents(
  tenantId: string,
  now: Date = new Date()
): Promise<CalendarData> {
  const window = getCalendarWindow(now);
  const navigable = getNavigableMonths(now);
  const todayISO = toISODate(startOfUtcDay(now));

  const prefs = await prisma.calendarPreference.findUnique({ where: { tenantId } });
  const disabledCategories = (prefs?.disabledCategories ?? []) as CalendarCategory[];
  const hiddenKeys = prefs?.hiddenKeys ?? [];

  const activeSources = CALENDAR_SOURCES.filter((s) => !disabledCategories.includes(s.category));
  const ctx = { tenantId, range: window, now };

  const results = await Promise.all(
    activeSources.map((source) => source.getEvents(ctx).catch(() => [] as CalendarEvent[]))
  );

  const counts = Object.fromEntries(CALENDAR_CATEGORIES.map((c) => [c, 0])) as Record<
    CalendarCategory,
    number
  >;
  const eventsByDay: Record<string, CalendarEvent[]> = {};

  for (const event of results.flat()) {
    if (isHidden(event.id, hiddenKeys)) continue;
    const end = event.endDate ?? event.date;
    const tagged: CalendarEvent = { ...event, isPast: end < todayISO };
    (eventsByDay[event.date] ??= []).push(tagged);
    counts[event.category] += 1;
  }

  const confirmedThrough = activeSources
    .map((s) => s.confirmedThrough)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null;

  return {
    window,
    navigable,
    todayISO,
    eventsByDay,
    counts,
    disabledCategories,
    confirmedThrough,
  };
}
