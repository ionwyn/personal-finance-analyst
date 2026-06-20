// ─── Calendar date primitives ──────────────────────────────────────────────
// All calendar math runs on UTC days to avoid timezone drift between the server
// and the rendered grid. Dates are exchanged as YYYY-MM-DD strings.

export type ISODate = string;

/** UTC midnight for the given Y/M/D (month is 0-based). */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** YYYY-MM-DD for a Date, using its UTC components. */
export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string to a UTC-midnight Date. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return utcDate(y!, (m ?? 1) - 1, d ?? 1);
}

/** Start of the UTC day for an arbitrary Date/timestamp. */
export function startOfUtcDay(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function addUtcDays(date: Date, days: number): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days);
}

/** Add (or subtract) whole months, clamping the day to the target month length. */
export function addUtcMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = lastDayOfMonth(targetYear, targetMonth);
  return utcDate(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay));
}

/** Last calendar day (28–31) of a 0-based month. */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

/** Roll a date forward to the next weekday when it lands on a weekend. This is
 *  the common "deadline observed on the next business day" rule used for tax
 *  filing dates (Apr 30 CA, Apr 15 US). It intentionally does NOT account for
 *  statutory holidays — those are jurisdiction-specific and rare enough that we
 *  treat the weekend roll as the documented approximation. */
export function businessDayRoll(date: Date): Date {
  const dow = date.getUTCDay();
  if (dow === 6) return addUtcDays(date, 2); // Sat → Mon
  if (dow === 0) return addUtcDays(date, 1); // Sun → Mon
  return date;
}

/** The nth (1-based) occurrence of a weekday in a month, e.g. first Friday for
 *  the Canadian Labour Force Survey. weekday: 0=Sun … 6=Sat. */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  const first = utcDate(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utcDate(year, month, 1 + offset + (n - 1) * 7);
}

/** Inclusive containment check against a YYYY-MM-DD range. */
export function isWithinRange(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end;
}
