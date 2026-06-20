// ─── Fixed calendar window ─────────────────────────────────────────────────
// The calendar shows a fixed span around "now": 3 months back, 6 months
// forward. This bounds both the external-API fetch surface and the months a
// user can navigate to. The window is a product constant, not user-configurable.

import { addUtcMonths, lastDayOfMonth, startOfUtcDay, toISODate, utcDate } from "@/lib/calendar/dates";
import type { CalendarRange } from "@/lib/calendar/types";

export const CALENDAR_BACK_MONTHS = 3;
export const CALENDAR_FORWARD_MONTHS = 6;

/** First-of-month for a given Date. */
function startOfMonth(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** Last-of-month for a given Date. */
function endOfMonth(date: Date): Date {
  return utcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth())
  );
}

/** The inclusive fetch window: full first month (now − back) through full last
 *  month (now + forward), as YYYY-MM-DD. */
export function getCalendarWindow(now: Date = new Date()): CalendarRange {
  const start = startOfMonth(addUtcMonths(startOfUtcDay(now), -CALENDAR_BACK_MONTHS));
  const end = endOfMonth(addUtcMonths(startOfUtcDay(now), CALENDAR_FORWARD_MONTHS));
  return { start: toISODate(start), end: toISODate(end) };
}

/** The navigable month bounds (first-of-month YYYY-MM strings) so the client can
 *  disable prev/next at the edges of the window. */
export function getNavigableMonths(now: Date = new Date()): {
  min: string; // YYYY-MM
  max: string; // YYYY-MM
  current: string; // YYYY-MM
} {
  const ym = (d: Date) => toISODate(d).slice(0, 7);
  const base = startOfUtcDay(now);
  return {
    min: ym(addUtcMonths(base, -CALENDAR_BACK_MONTHS)),
    max: ym(addUtcMonths(base, CALENDAR_FORWARD_MONTHS)),
    current: ym(base),
  };
}
