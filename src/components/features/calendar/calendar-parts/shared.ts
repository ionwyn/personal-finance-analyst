import { addUtcDays, toISODate, utcDate } from "@/lib/calendar/dates";
import {
  CATEGORY_META,
  type CalendarCategory,
  type CalendarConfidence,
  type CalendarEvent,
} from "@/lib/calendar/types";

/** Monday-first weekday headers. The week start is fixed (no setting). */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type GridCell = { iso: string; day: number; inMonth: boolean };

/** Build the weeks (5–6 rows) for a YYYY-MM month, Monday-first. */
export function buildWeeks(monthISO: string): GridCell[][] {
  const [y, m] = monthISO.split("-").map(Number);
  const monthIdx = (m ?? 1) - 1;
  const firstOfMonth = utcDate(y!, monthIdx, 1);
  const lead = (firstOfMonth.getUTCDay() + 6) % 7; // days since Monday
  const daysInMonth = new Date(Date.UTC(y!, monthIdx + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const gridStart = addUtcDays(firstOfMonth, -lead);

  const cells: GridCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const d = addUtcDays(gridStart, i);
    cells.push({ iso: toISODate(d), day: d.getUTCDate(), inMonth: d.getUTCMonth() === monthIdx });
  }
  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Shift a YYYY-MM month string by whole months. */
export function shiftMonth(monthISO: string, delta: number): string {
  const [y, m] = monthISO.split("-").map(Number);
  return toISODate(utcDate(y!, (m ?? 1) - 1 + delta, 1)).slice(0, 7);
}

export function monthLabel(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function categoryColorVar(category: CalendarCategory): string {
  return `var(${CATEGORY_META[category].colorVar})`;
}

/** Short qualifier shown next to provisional events. Confirmed facts get none. */
export const CONFIDENCE_LABEL: Record<CalendarConfidence, string> = {
  confirmed: "",
  scheduled: "scheduled",
  estimated: "est.",
  window: "window",
};

/** Sort within a day: category render order, then title. */
export function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.title.localeCompare(b.title));
}
