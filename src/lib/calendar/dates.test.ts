import { describe, expect, it } from "vitest";

import {
  addUtcDays,
  addUtcMonths,
  businessDayRoll,
  fromISODate,
  lastDayOfMonth,
  nthWeekdayOfMonth,
  toISODate,
} from "./dates";

describe("addUtcMonths", () => {
  it("clamps to the target month length", () => {
    expect(toISODate(addUtcMonths(fromISODate("2026-01-31"), 1))).toBe("2026-02-28");
    expect(toISODate(addUtcMonths(fromISODate("2026-03-31"), -1))).toBe("2026-02-28");
    expect(toISODate(addUtcMonths(fromISODate("2024-01-31"), 1))).toBe("2024-02-29");
  });

  it("rolls across year boundaries", () => {
    expect(toISODate(addUtcMonths(fromISODate("2026-11-15"), 3))).toBe("2027-02-15");
    expect(toISODate(addUtcMonths(fromISODate("2026-02-15"), -3))).toBe("2025-11-15");
  });
});

describe("lastDayOfMonth", () => {
  it("handles February and leap years", () => {
    expect(lastDayOfMonth(2026, 1)).toBe(28);
    expect(lastDayOfMonth(2024, 1)).toBe(29);
    expect(lastDayOfMonth(2026, 0)).toBe(31);
  });
});

describe("businessDayRoll", () => {
  it("never returns a weekend and only moves forward by up to two days", () => {
    let d = fromISODate("2026-01-01");
    for (let i = 0; i < 400; i += 1) {
      const rolled = businessDayRoll(d);
      expect([0, 6]).not.toContain(rolled.getUTCDay());
      const deltaDays = (rolled.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
      expect(deltaDays).toBeGreaterThanOrEqual(0);
      expect(deltaDays).toBeLessThanOrEqual(2);
      d = addUtcDays(d, 1);
    }
  });

  it("rolls Saturday and Sunday to Monday", () => {
    // 2026-04-18 is a Saturday, 2026-04-19 a Sunday.
    expect(toISODate(businessDayRoll(fromISODate("2026-04-18")))).toBe("2026-04-20");
    expect(toISODate(businessDayRoll(fromISODate("2026-04-19")))).toBe("2026-04-20");
    expect(toISODate(businessDayRoll(fromISODate("2026-04-17")))).toBe("2026-04-17");
  });
});

describe("nthWeekdayOfMonth", () => {
  it("returns the nth weekday within the month", () => {
    const firstFriday = nthWeekdayOfMonth(2026, 5, 5, 1); // June 2026, Friday
    expect(firstFriday.getUTCDay()).toBe(5);
    expect(firstFriday.getUTCDate()).toBeLessThanOrEqual(7);

    const thirdTuesday = nthWeekdayOfMonth(2026, 5, 2, 3);
    expect(thirdTuesday.getUTCDay()).toBe(2);
    expect(thirdTuesday.getUTCDate()).toBeGreaterThanOrEqual(15);
    expect(thirdTuesday.getUTCDate()).toBeLessThanOrEqual(21);
  });
});
