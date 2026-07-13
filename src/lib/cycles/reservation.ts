import { Prisma } from "@prisma/client";

import type { Frequency } from "@/lib/cycles/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── UTC date helpers (mirror generate.ts / getCurrentCycle.ts conventions) ──

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime()) / DAY_MS);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfMonth(year, month))));
}

/**
 * Cycle-start that contains `date`, aligned to the same fixed-length grid as the
 * tenant's pay cycles. Any real cycle start can serve as the `anchor` because all
 * cycle starts are congruent modulo `lengthDays` — so callers pass the current
 * cycle's own start and never need to fetch the pay anchor from settings.
 */
function cycleStartForDate(anchor: Date, date: Date, lengthDays: number): Date {
  const stride = Math.floor(diffDays(date, anchor) / lengthDays);
  return addDays(startOfUtcDay(anchor), stride * lengthDays);
}

/** Number of whole cycle strides between two cycle-aligned starts (b − a). */
function cycleStrides(aStart: Date, bStart: Date, lengthDays: number): number {
  return Math.round(diffDays(bStart, aStart) / lengthDays);
}

// ─── Occurrence projection ───────────────────────────────────────────────────

export type ReservationExpense = {
  amount: Prisma.Decimal | number;
  frequency: string;
  nextDueDate: Date | null;
  accrualPerCycle: Prisma.Decimal | number;
  createdAt?: Date;
};

function stepDaysFor(frequency: Frequency): number | null {
  if (frequency === "weekly") return 7;
  if (frequency === "biweekly") return 14;
  return null; // monthly / annual step by calendar month/year
}

/**
 * The occurrence on or after `date` (UTC-day granularity). Patterns extend
 * infinitely in both directions from `nextDueDate`, so this always resolves.
 */
export function nextOccurrenceOnOrAfter(
  nextDueDate: Date,
  frequency: Frequency,
  date: Date
): Date {
  const anchor = startOfUtcDay(nextDueDate);
  const target = startOfUtcDay(date);
  const step = stepDaysFor(frequency);
  if (step !== null) {
    const k = Math.ceil(diffDays(target, anchor) / step);
    return addDays(anchor, k * step);
  }
  const day = anchor.getUTCDate();
  if (frequency === "monthly") {
    let y = target.getUTCFullYear();
    let m = target.getUTCMonth();
    let cand = utcDay(y, m, day);
    if (cand < target) {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
      cand = utcDay(y, m, day);
    }
    return cand;
  }
  // annual: fixed month-of-year + day
  const month = anchor.getUTCMonth();
  const y = target.getUTCFullYear();
  let cand = utcDay(y, month, day);
  if (cand < target) cand = utcDay(y + 1, month, day);
  return cand;
}

/** The occurrence strictly before `date`. */
export function previousOccurrenceBefore(
  nextDueDate: Date,
  frequency: Frequency,
  date: Date
): Date {
  const anchor = startOfUtcDay(nextDueDate);
  const target = startOfUtcDay(date);
  const step = stepDaysFor(frequency);
  if (step !== null) {
    const k = Math.ceil(diffDays(target, anchor) / step) - 1;
    return addDays(anchor, k * step);
  }
  const day = anchor.getUTCDate();
  if (frequency === "monthly") {
    let y = target.getUTCFullYear();
    let m = target.getUTCMonth();
    let cand = utcDay(y, m, day);
    if (cand >= target) {
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
      cand = utcDay(y, m, day);
    }
    return cand;
  }
  const month = anchor.getUTCMonth();
  const y = target.getUTCFullYear();
  let cand = utcDay(y, month, day);
  if (cand >= target) cand = utcDay(y - 1, month, day);
  return cand;
}

/** All occurrences within [from, to] inclusive (UTC-day granularity). */
export function occurrencesInRange(
  expense: Pick<ReservationExpense, "nextDueDate" | "frequency">,
  from: Date,
  to: Date
): Date[] {
  if (!expense.nextDueDate) return [];
  const freq = expense.frequency as Frequency;
  const toDay = startOfUtcDay(to);
  const out: Date[] = [];
  let cursor = nextOccurrenceOnOrAfter(expense.nextDueDate, freq, from);
  // Guard against an unbounded loop on bad input.
  for (let i = 0; i < 1000 && cursor <= toDay; i += 1) {
    out.push(cursor);
    cursor = nextOccurrenceOnOrAfter(expense.nextDueDate, freq, addDays(cursor, 1));
  }
  return out;
}

// ─── Cumulative-pot reservation ──────────────────────────────────────────────

export type CycleReservation = {
  /** Dollars to fence in this cycle (the running pot, or the full amount at due). */
  reserved: Prisma.Decimal;
  /** True when an occurrence lands inside this cycle. */
  isDueCycle: boolean;
  /** The occurrence this cycle is accruing toward / settling (null on fallback). */
  dueDate: Date | null;
  /** Cycles in the current accrual span (debug/UX). */
  spanCycles: number;
  /** 1-indexed position of this cycle within the span. */
  position: number;
};

function toDecimal(value: Prisma.Decimal | number): Prisma.Decimal {
  return typeof value === "number" ? new Prisma.Decimal(value) : value;
}

/**
 * Compute the cumulative-pot reservation for one recurring expense in one cycle.
 *
 *   • due cycle           → reserve the full amount (Principle 1)
 *   • cycle before due    → reserve position × (amount / spanCycles) (Principle 2)
 *   • weekly/biweekly     → reserve amount × occurrences-in-cycle (due every cycle)
 *   • nextDueDate == null → fall back to the flat accrualPerCycle slice
 *
 * Depends only on the cycle's own dates: `lengthDays` is derived from the window
 * and the cycle start doubles as the stride anchor.
 */
export function computeCycleReservation(
  expense: ReservationExpense,
  cycle: { startDate: Date; endDate: Date }
): CycleReservation {
  const amount = toDecimal(expense.amount);
  const cycleStart = startOfUtcDay(cycle.startDate);
  const cycleEnd = startOfUtcDay(cycle.endDate);

  if (!expense.nextDueDate) {
    return {
      reserved: toDecimal(expense.accrualPerCycle),
      isDueCycle: false,
      dueDate: null,
      spanCycles: 1,
      position: 1,
    };
  }

  const freq = expense.frequency as Frequency;
  const lengthDays = diffDays(cycleEnd, cycleStart) + 1;

  // Frequencies at or below the cycle length recur within the cycle — they are
  // "due every cycle", so reserve the full amount per occurrence (no multi-cycle
  // pot). This reproduces today's accrualPerCycle for weekly/biweekly.
  if (freq === "weekly" || freq === "biweekly") {
    const occ = occurrencesInRange(expense, cycleStart, cycleEnd);
    return {
      reserved: amount.mul(occ.length),
      isDueCycle: occ.length > 0,
      dueDate: occ[0] ?? null,
      spanCycles: 1,
      position: 1,
    };
  }

  // monthly / annual
  const nextOcc = nextOccurrenceOnOrAfter(expense.nextDueDate, freq, cycleStart);

  // Due cycle: the full amount leaves this cycle (Principle 1).
  if (nextOcc <= cycleEnd) {
    return { reserved: amount, isDueCycle: true, dueDate: nextOcc, spanCycles: 1, position: 1 };
  }

  // Accruing toward a future occurrence: ramp the pot across the span.
  const prevOcc = previousOccurrenceBefore(expense.nextDueDate, freq, nextOcc);
  const dueCycleStart = cycleStartForDate(cycleStart, nextOcc, lengthDays);
  const afterPrevCycleStart = addDays(cycleStartForDate(cycleStart, prevOcc, lengthDays), lengthDays);

  // Floor the span at the expense's creation cycle so a brand-new expense never
  // inherits a pot it never funded.
  let spanStart = afterPrevCycleStart;
  if (expense.createdAt) {
    const createdCycleStart = cycleStartForDate(cycleStart, expense.createdAt, lengthDays);
    if (createdCycleStart > spanStart) spanStart = createdCycleStart;
  }
  if (spanStart > cycleStart) spanStart = cycleStart;

  const spanCycles = Math.max(1, cycleStrides(spanStart, dueCycleStart, lengthDays) + 1);
  const position = Math.min(
    spanCycles,
    Math.max(1, cycleStrides(spanStart, cycleStart, lengthDays) + 1)
  );

  const slice = amount.div(spanCycles);
  return {
    reserved: slice.mul(position),
    isDueCycle: false,
    dueDate: nextOcc,
    spanCycles,
    position,
  };
}
