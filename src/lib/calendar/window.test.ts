import { describe, expect, it } from "vitest";

import { getCalendarWindow, getNavigableMonths } from "./window";

const NOW = new Date("2026-06-20T12:00:00Z");

describe("getCalendarWindow", () => {
  it("spans the full month 3 back through the full month 6 forward", () => {
    expect(getCalendarWindow(NOW)).toEqual({ start: "2026-03-01", end: "2026-12-31" });
  });

  it("crosses year boundaries", () => {
    expect(getCalendarWindow(new Date("2026-11-10T00:00:00Z"))).toEqual({
      start: "2026-08-01",
      end: "2027-05-31",
    });
  });
});

describe("getNavigableMonths", () => {
  it("returns clamped month bounds around now", () => {
    expect(getNavigableMonths(NOW)).toEqual({
      min: "2026-03",
      max: "2026-12",
      current: "2026-06",
    });
  });
});
