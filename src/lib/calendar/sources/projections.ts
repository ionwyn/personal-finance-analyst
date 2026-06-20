// ─── Recurrence projection helpers ─────────────────────────────────────────
// Shared date-enumeration used by the app-owned Personal Finance sources. All
// outputs are YYYY-MM-DD strings clamped to the calendar window.

import {
  addUtcDays,
  fromISODate,
  lastDayOfMonth,
  toISODate,
  utcDate,
} from "@/lib/calendar/dates";
import type { CalendarRange } from "@/lib/calendar/types";

/** One occurrence per month on `dayOfMonth` (clamped to month length), across
 *  every month touched by the window. The only date signal recurring expenses
 *  store is a day-of-month anchor, so all such bills are projected monthly —
 *  consistent with how the pay-cycle view derives a bill's due date. */
export function monthlyOccurrences(range: CalendarRange, dayOfMonth: number): string[] {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1) return [];
  const start = fromISODate(range.start);
  const end = fromISODate(range.end);
  const out: string[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  // Walk month-by-month until we pass the window end.
  for (;;) {
    const cursor = utcDate(year, month, 1);
    if (cursor > end) break;
    const day = Math.min(dayOfMonth, lastDayOfMonth(year, month));
    const candidate = utcDate(year, month, day);
    if (candidate >= start && candidate <= end) out.push(toISODate(candidate));
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return out;
}

/** Occurrences of a fixed-day cadence (e.g. biweekly pay) that fall inside the
 *  window, walking outward from `anchorISO` in both directions by `stepDays`. */
export function cadenceOccurrences(
  range: CalendarRange,
  anchorISO: string,
  stepDays: number
): string[] {
  if (!Number.isInteger(stepDays) || stepDays < 1) return [];
  const start = fromISODate(range.start);
  const end = fromISODate(range.end);
  const anchor = fromISODate(anchorISO);

  // Find the earliest occurrence >= window start.
  const dayMs = 24 * 60 * 60 * 1000;
  const deltaDays = Math.round((start.getTime() - anchor.getTime()) / dayMs);
  const stepsToStart = Math.ceil(deltaDays / stepDays);
  let cursor = addUtcDays(anchor, stepsToStart * stepDays);

  const out: string[] = [];
  while (cursor <= end) {
    if (cursor >= start) out.push(toISODate(cursor));
    cursor = addUtcDays(cursor, stepDays);
  }
  return out;
}
