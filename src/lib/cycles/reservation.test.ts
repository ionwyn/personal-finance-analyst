import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  computeCycleReservation,
  nextOccurrenceOnOrAfter,
  previousOccurrenceBefore,
  occurrencesInRange,
  type ReservationExpense,
} from "@/lib/cycles/reservation";

const DAY_MS = 24 * 60 * 60 * 1000;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Build `count` consecutive 14-day cycles starting at `start`. */
function buildCycles(start: Date, count: number, lengthDays = 14) {
  const cycles: { startDate: Date; endDate: Date }[] = [];
  for (let i = 0; i < count; i += 1) {
    const s = new Date(start.getTime() + i * lengthDays * DAY_MS);
    const e = new Date(s.getTime() + (lengthDays - 1) * DAY_MS);
    cycles.push({ startDate: s, endDate: e });
  }
  return cycles;
}

const num = (d: Prisma.Decimal) => Number(d.toString());

describe("occurrence projection", () => {
  it("projects monthly occurrences across a range on the anchor day", () => {
    const exp = { nextDueDate: utc(2026, 6, 15), frequency: "monthly" };
    const occ = occurrencesInRange(exp, utc(2026, 1, 1), utc(2026, 4, 30)).map((d) =>
      d.toISOString().slice(0, 10)
    );
    expect(occ).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("projects an annual occurrence once per year on month+day", () => {
    const exp = { nextDueDate: utc(2026, 11, 3), frequency: "annual" };
    const occ = occurrencesInRange(exp, utc(2025, 1, 1), utc(2027, 12, 31)).map((d) =>
      d.toISOString().slice(0, 10)
    );
    expect(occ).toEqual(["2025-11-03", "2026-11-03", "2027-11-03"]);
  });

  it("clamps the day to the month length (31st → Feb)", () => {
    const exp = { nextDueDate: utc(2026, 1, 31), frequency: "monthly" };
    const occ = occurrencesInRange(exp, utc(2026, 2, 1), utc(2026, 2, 28)).map((d) =>
      d.toISOString().slice(0, 10)
    );
    expect(occ).toEqual(["2026-02-28"]);
  });

  it("projects forward even when nextDueDate is in the past", () => {
    const next = nextOccurrenceOnOrAfter(utc(2020, 6, 10), "monthly", utc(2026, 6, 1));
    expect(next.toISOString().slice(0, 10)).toBe("2026-06-10");
  });

  it("handles biweekly phase via fixed-day stepping", () => {
    const next = nextOccurrenceOnOrAfter(utc(2026, 6, 1), "biweekly", utc(2026, 6, 2));
    expect(next.toISOString().slice(0, 10)).toBe("2026-06-15");
    const prev = previousOccurrenceBefore(utc(2026, 6, 1), "biweekly", utc(2026, 6, 15));
    expect(prev.toISOString().slice(0, 10)).toBe("2026-06-01");
  });
});

describe("computeCycleReservation — monthly cumulative pot", () => {
  const rent: ReservationExpense = {
    amount: 1300,
    frequency: "monthly",
    nextDueDate: utc(2026, 6, 30),
    accrualPerCycle: 650,
  };

  it("ramps the pot up to the full amount, with the due cycle at full", () => {
    // 6 consecutive cycles around two month-end occurrences (May 30 / Jun 30).
    const cycles = buildCycles(utc(2026, 5, 4), 6);
    const results = cycles.map((c) => computeCycleReservation(rent, c));

    // Find the cycle that actually contains the Jun 30 occurrence.
    const dueIdx = results.findIndex(
      (r, i) => r.isDueCycle && cycles[i].startDate >= utc(2026, 6, 1)
    );
    expect(dueIdx).toBeGreaterThan(0);
    expect(num(results[dueIdx].reserved)).toBe(1300); // Principle 1: full at due

    const due = results[dueIdx];
    // The cycles leading up to it ramp as k / spanCycles × amount, k = 1..N-1.
    const ramp = results.slice(dueIdx - (due.spanCycles - 1), dueIdx);
    ramp.forEach((r, k) => {
      expect(num(r.reserved)).toBeCloseTo((1300 * (k + 1)) / due.spanCycles, 6);
      expect(r.isDueCycle).toBe(false);
    });
    // Monotonic non-decreasing into the due cycle, and never over the full amount.
    for (let i = dueIdx - (due.spanCycles - 1); i <= dueIdx; i += 1) {
      expect(num(results[i].reserved)).toBeLessThanOrEqual(1300 + 1e-9);
      if (i > dueIdx - (due.spanCycles - 1)) {
        expect(num(results[i].reserved)).toBeGreaterThan(num(results[i - 1].reserved));
      }
    }
  });
});

describe("computeCycleReservation — annual cumulative pot", () => {
  const tax: ReservationExpense = {
    amount: 2600,
    frequency: "annual",
    nextDueDate: utc(2026, 12, 1),
    accrualPerCycle: 100,
  };

  it("reserves the full amount in the due cycle", () => {
    const cycles = buildCycles(utc(2026, 11, 24), 1); // contains Dec 1
    const r = computeCycleReservation(tax, cycles[0]);
    expect(r.isDueCycle).toBe(true);
    expect(num(r.reserved)).toBe(2600);
  });

  it("ramps a small early-year pot far below the full amount", () => {
    const early = { startDate: utc(2026, 3, 2), endDate: utc(2026, 3, 15) };
    const late = { startDate: utc(2026, 11, 10), endDate: utc(2026, 11, 23) };
    const rEarly = computeCycleReservation(tax, early);
    const rLate = computeCycleReservation(tax, late);
    expect(rEarly.isDueCycle).toBe(false);
    expect(num(rEarly.reserved)).toBeGreaterThan(0);
    expect(num(rEarly.reserved)).toBeLessThan(num(rLate.reserved)); // pot grows over the year
    expect(num(rLate.reserved)).toBeLessThan(2600); // still under full just before due
    expect(rEarly.spanCycles).toBeGreaterThanOrEqual(24); // ~26 cycles/year
  });
});

describe("computeCycleReservation — sub-cycle frequencies & fallback", () => {
  it("reserves the full per-occurrence amount each cycle for biweekly", () => {
    const exp: ReservationExpense = {
      amount: 150,
      frequency: "biweekly",
      nextDueDate: utc(2026, 6, 1),
      accrualPerCycle: 150,
    };
    const cycle = { startDate: utc(2026, 6, 1), endDate: utc(2026, 6, 14) };
    const r = computeCycleReservation(exp, cycle);
    expect(num(r.reserved)).toBe(150);
    expect(r.isDueCycle).toBe(true);
  });

  it("reserves two occurrences per cycle for weekly", () => {
    const exp: ReservationExpense = {
      amount: 75,
      frequency: "weekly",
      nextDueDate: utc(2026, 6, 1),
      accrualPerCycle: 150,
    };
    const cycle = { startDate: utc(2026, 6, 1), endDate: utc(2026, 6, 14) };
    const r = computeCycleReservation(exp, cycle);
    expect(num(r.reserved)).toBe(150); // 75 × 2
  });

  it("falls back to the flat accrual slice when nextDueDate is null", () => {
    const exp: ReservationExpense = {
      amount: 2600,
      frequency: "annual",
      nextDueDate: null,
      accrualPerCycle: 100,
    };
    const cycle = { startDate: utc(2026, 6, 1), endDate: utc(2026, 6, 14) };
    const r = computeCycleReservation(exp, cycle);
    expect(num(r.reserved)).toBe(100);
    expect(r.isDueCycle).toBe(false);
    expect(r.dueDate).toBeNull();
  });
});
