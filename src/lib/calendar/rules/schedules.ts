// ─── Hand-maintained agency schedules (config) ──────────────────────────────
// FOMC, Bank of Canada, and Statistics Canada do not expose a free release-
// calendar API, so their forward dates are encoded here. This is the rule-rot
// surface the design calls out: every block carries `confirmedThrough` (shown
// in the UI) and an `asOf` note. Re-verify against the official calendars each
// year and extend the base date lists. Keep all such dates in THIS file only.
//
//   FOMC:  https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
//   BoC:   https://www.bankofcanada.ca/press/upcoming-events/
//   StatCan release schedule: https://www150.statcan.gc.ca/n1/dai-quo/index-eng.htm

import { addUtcDays, fromISODate, nthWeekdayOfMonth, toISODate } from "@/lib/calendar/dates";
import type { CalendarCategory, CalendarConfidence } from "@/lib/calendar/types";

export type ScheduleEvent = {
  date: string; // YYYY-MM-DD
  /** Hide-key prefix; the event id becomes `${itemKey}:${date}`. */
  itemKey: string;
  type: string;
  title: string;
  confidence: CalendarConfidence;
};

export type FixedSchedule = {
  id: string;
  category: CalendarCategory;
  label: string;
  attribution: string;
  /** Last date this schedule is known-good through. */
  confirmedThrough: string;
  asOf: string;
  events: ScheduleEvent[];
  items: { key: string; label: string }[];
};

const plus = (iso: string, days: number) => toISODate(addUtcDays(fromISODate(iso), days));

// ── US Federal Reserve / FOMC (2026) ────────────────────────────────────────
// Decision day = second meeting day. SEP at Mar/Jun/Sep/Dec. Minutes land three
// weeks after each meeting.
const FOMC_2026: { date: string; sep: boolean }[] = [
  { date: "2026-01-28", sep: false },
  { date: "2026-03-18", sep: true },
  { date: "2026-04-29", sep: false },
  { date: "2026-06-17", sep: true },
  { date: "2026-07-29", sep: false },
  { date: "2026-09-16", sep: true },
  { date: "2026-10-28", sep: false },
  { date: "2026-12-09", sep: true },
];

export const FOMC_SCHEDULE: FixedSchedule = {
  id: "fomc",
  category: "macro-us",
  label: "Federal Reserve",
  attribution: "Federal Reserve (FOMC)",
  confirmedThrough: "2026-12-31",
  asOf: "2026-06-20",
  events: FOMC_2026.flatMap((m) => {
    const events: ScheduleEvent[] = [
      {
        date: m.date,
        itemKey: "fomc-meeting",
        type: "fomc-meeting",
        title: "FOMC rate decision",
        confidence: "scheduled",
      },
      {
        date: plus(m.date, 21),
        itemKey: "fomc-minutes",
        type: "fomc-minutes",
        title: "FOMC minutes",
        confidence: "estimated",
      },
    ];
    if (m.sep) {
      events.push({
        date: m.date,
        itemKey: "fomc-sep",
        type: "fomc-sep",
        title: "Fed economic projections (SEP)",
        confidence: "scheduled",
      });
    }
    return events;
  }),
  items: [
    { key: "fomc-meeting", label: "FOMC rate decisions" },
    { key: "fomc-minutes", label: "FOMC minutes" },
    { key: "fomc-sep", label: "Fed economic projections" },
  ],
};

// ── Bank of Canada (2026) ───────────────────────────────────────────────────
// Fixed announcement dates. MPR at Jan/Apr/Jul/Oct. Summary of Deliberations
// ~two weeks after each decision.
const BOC_2026: { date: string; mpr: boolean }[] = [
  { date: "2026-01-28", mpr: true },
  { date: "2026-03-11", mpr: false },
  { date: "2026-04-15", mpr: true },
  { date: "2026-06-03", mpr: false },
  { date: "2026-07-29", mpr: true },
  { date: "2026-09-16", mpr: false },
  { date: "2026-10-28", mpr: true },
  { date: "2026-12-09", mpr: false },
];

export const BOC_SCHEDULE: FixedSchedule = {
  id: "boc",
  category: "macro-ca",
  label: "Bank of Canada",
  attribution: "Bank of Canada",
  confirmedThrough: "2026-12-31",
  asOf: "2026-06-20",
  events: BOC_2026.flatMap((m) => {
    const events: ScheduleEvent[] = [
      {
        date: m.date,
        itemKey: "boc-decision",
        type: "boc-decision",
        title: "BoC rate decision",
        confidence: "scheduled",
      },
      {
        date: plus(m.date, 14),
        itemKey: "boc-deliberations",
        type: "boc-deliberations",
        title: "BoC Summary of Deliberations",
        confidence: "estimated",
      },
    ];
    if (m.mpr) {
      events.push({
        date: m.date,
        itemKey: "boc-mpr",
        type: "boc-mpr",
        title: "Monetary Policy Report",
        confidence: "scheduled",
      });
    }
    return events;
  }),
  items: [
    { key: "boc-decision", label: "BoC rate decisions" },
    { key: "boc-mpr", label: "Monetary Policy Report" },
    { key: "boc-deliberations", label: "Summary of Deliberations" },
  ],
};

// ── Statistics Canada (2026, approximate) ───────────────────────────────────
// StatCan has no free release-calendar API, so these follow documented rules of
// thumb (LFS ≈ first Friday; CPI ≈ third Tuesday; GDP ≈ last business day) and
// are flagged "estimated". Replace with the published schedule when verifying.
function statcanEvents(): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  for (let month = 0; month < 12; month += 1) {
    const lfs = nthWeekdayOfMonth(2026, month, 5, 1); // first Friday
    const cpi = nthWeekdayOfMonth(2026, month, 2, 3); // third Tuesday
    const gdpDate = new Date(Date.UTC(2026, month + 1, 0)); // last day of month
    events.push(
      {
        date: toISODate(lfs),
        itemKey: "ca-lfs",
        type: "ca-lfs",
        title: "Canada Labour Force Survey",
        confidence: "estimated",
      },
      {
        date: toISODate(cpi),
        itemKey: "ca-cpi",
        type: "ca-cpi",
        title: "Canada CPI release",
        confidence: "estimated",
      },
      {
        date: toISODate(gdpDate),
        itemKey: "ca-gdp",
        type: "ca-gdp",
        title: "Canada GDP release",
        confidence: "estimated",
      }
    );
  }
  return events;
}

export const STATCAN_SCHEDULE: FixedSchedule = {
  id: "statcan",
  category: "macro-ca",
  label: "Statistics Canada",
  attribution: "Statistics Canada (approx.)",
  confirmedThrough: "2026-12-31",
  asOf: "2026-06-20",
  events: statcanEvents(),
  items: [
    { key: "ca-cpi", label: "Canada CPI" },
    { key: "ca-gdp", label: "Canada GDP" },
    { key: "ca-lfs", label: "Labour Force Survey" },
  ],
};

export const FIXED_SCHEDULES: FixedSchedule[] = [
  FOMC_SCHEDULE,
  BOC_SCHEDULE,
  STATCAN_SCHEDULE,
];
