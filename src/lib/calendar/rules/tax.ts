// ─── Statutory tax dates (rules, not hand-maintained config) ────────────────
// These are computed from formula for any year, so they never go stale the way
// the agency schedules do. Deadlines roll to the next business day on weekends;
// resets/cutoffs (Jan 1, Dec 31) and document windows do not.

import { businessDayRoll, toISODate, utcDate } from "@/lib/calendar/dates";
import type { CalendarConfidence } from "@/lib/calendar/types";

export type TaxGroup = "ca" | "us" | "slips";

export type TaxEvent = {
  group: TaxGroup;
  date: string; // YYYY-MM-DD
  endDate?: string; // for availability windows
  itemKey: string;
  type: string;
  title: string;
  confidence: CalendarConfidence;
};

const iso = (year: number, month0: number, day: number) => toISODate(utcDate(year, month0, day));
const deadline = (year: number, month0: number, day: number) =>
  toISODate(businessDayRoll(utcDate(year, month0, day)));

/** The 60th day of the year (RRSP contribution deadline for the prior tax year). */
function sixtiethDay(year: number): string {
  const d = utcDate(year, 0, 1);
  d.setUTCDate(d.getUTCDate() + 59);
  return toISODate(businessDayRoll(d));
}

function caEvents(year: number): TaxEvent[] {
  return [
    {
      group: "ca",
      date: iso(year, 0, 1),
      itemKey: "ca-tfsa-reset",
      type: "ca-tfsa-reset",
      title: "TFSA contribution room resets",
      confidence: "confirmed",
    },
    {
      group: "ca",
      date: sixtiethDay(year),
      itemKey: "ca-rrsp",
      type: "ca-rrsp",
      title: "RRSP contribution deadline",
      confidence: "confirmed",
    },
    {
      group: "ca",
      date: deadline(year, 3, 30),
      itemKey: "ca-t1",
      type: "ca-t1",
      title: "T1 filing deadline",
      confidence: "confirmed",
    },
    {
      group: "ca",
      date: deadline(year, 5, 15),
      itemKey: "ca-t1-self",
      type: "ca-t1-self",
      title: "T1 filing deadline (self-employed)",
      confidence: "confirmed",
    },
    {
      group: "ca",
      date: iso(year, 11, 31),
      itemKey: "ca-fhsa",
      type: "ca-fhsa",
      title: "FHSA contribution deadline",
      confidence: "confirmed",
    },
    {
      group: "ca",
      date: iso(year, 11, 31),
      itemKey: "ca-resp",
      type: "ca-resp",
      title: "RESP grant contribution cutoff",
      confidence: "confirmed",
    },
  ];
}

function usEvents(year: number): TaxEvent[] {
  const estimated: TaxEvent[] = [
    { date: deadline(year, 3, 15), q: "Q1" },
    { date: deadline(year, 5, 15), q: "Q2" },
    { date: deadline(year, 8, 15), q: "Q3" },
    { date: deadline(year + 1, 0, 15), q: "Q4" },
  ].map(({ date, q }) => ({
    group: "us" as const,
    date,
    itemKey: "us-estimated",
    type: "us-estimated",
    title: `US estimated tax · ${q}`,
    confidence: "confirmed" as const,
  }));

  return [
    {
      group: "us",
      date: deadline(year, 3, 15),
      itemKey: "us-filing",
      type: "us-filing",
      title: "US individual tax filing deadline",
      confidence: "confirmed",
    },
    ...estimated,
  ];
}

// Issuer statutory deadlines → "expected availability" windows, not hard dates.
function slipEvents(year: number): TaxEvent[] {
  return [
    {
      group: "slips",
      date: iso(year, 1, 1),
      endDate: iso(year, 1, new Date(Date.UTC(year, 2, 0)).getUTCDate()), // end of Feb
      itemKey: "ca-slips-feb",
      type: "ca-slips-feb",
      title: "Canadian T4 / T5 slips (expected)",
      confidence: "window",
    },
    {
      group: "slips",
      date: iso(year, 2, 1),
      endDate: iso(year, 2, 31),
      itemKey: "ca-slips-mar",
      type: "ca-slips-mar",
      title: "Canadian T3 / T5008 slips (expected)",
      confidence: "window",
    },
    {
      group: "slips",
      date: iso(year, 0, 15),
      endDate: iso(year, 0, 31),
      itemKey: "us-slips-jan",
      type: "us-slips-jan",
      title: "US W-2 / 1099-NEC (expected)",
      confidence: "window",
    },
    {
      group: "slips",
      date: iso(year, 1, 15),
      endDate: iso(year, 2, 15),
      itemKey: "us-1099-consolidated",
      type: "us-1099-consolidated",
      title: "US consolidated 1099 (expected)",
      confidence: "window",
    },
    {
      group: "slips",
      date: iso(year, 2, 1),
      endDate: iso(year, 2, 15),
      itemKey: "us-k1",
      type: "us-k1",
      title: "US Schedule K-1 (expected)",
      confidence: "window",
    },
  ];
}

/** All statutory tax events for a single calendar year. */
export function buildTaxEvents(year: number): TaxEvent[] {
  return [...caEvents(year), ...usEvents(year), ...slipEvents(year)];
}

export const TAX_ITEMS: Record<TaxGroup, { key: string; label: string }[]> = {
  ca: [
    { key: "ca-tfsa-reset", label: "TFSA room reset" },
    { key: "ca-rrsp", label: "RRSP deadline" },
    { key: "ca-t1", label: "T1 filing deadline" },
    { key: "ca-t1-self", label: "T1 deadline (self-employed)" },
    { key: "ca-fhsa", label: "FHSA deadline" },
    { key: "ca-resp", label: "RESP grant cutoff" },
  ],
  us: [
    { key: "us-filing", label: "US filing deadline" },
    { key: "us-estimated", label: "US estimated tax" },
  ],
  slips: [
    { key: "ca-slips-feb", label: "Canadian T4/T5 window" },
    { key: "ca-slips-mar", label: "Canadian T3/T5008 window" },
    { key: "us-slips-jan", label: "US W-2/1099 window" },
    { key: "us-1099-consolidated", label: "US consolidated 1099 window" },
    { key: "us-k1", label: "US K-1 window" },
  ],
};
