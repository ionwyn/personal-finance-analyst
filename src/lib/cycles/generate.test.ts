import { describe, expect, it } from "vitest";

import { CYCLE_LENGTH_DAYS, cycleEndForStart, cycleStartForDate } from "@/lib/cycles/generate";

function utcDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("cycle math", () => {
  it("returns the anchor itself when date equals anchor", () => {
    const anchor = utcDate("2026-05-01");
    expect(cycleStartForDate(anchor, anchor).toISOString()).toBe(anchor.toISOString());
  });

  it("computes the cycle start for a date later in the same cycle", () => {
    const anchor = utcDate("2026-05-01");
    const target = utcDate("2026-05-10");
    expect(cycleStartForDate(anchor, target).toISOString()).toBe(anchor.toISOString());
  });

  it("steps forward exactly one stride after 14 days", () => {
    const anchor = utcDate("2026-05-01");
    const target = utcDate("2026-05-15");
    expect(cycleStartForDate(anchor, target).toISOString()).toBe(
      utcDate("2026-05-15").toISOString()
    );
  });

  it("steps backward for dates before the anchor", () => {
    const anchor = utcDate("2026-05-01");
    const target = utcDate("2026-04-25");
    expect(cycleStartForDate(anchor, target).toISOString()).toBe(
      utcDate("2026-04-17").toISOString()
    );
  });

  it("end date is 13 days after start", () => {
    const start = utcDate("2026-05-01");
    const end = cycleEndForStart(start);
    expect(end.toISOString()).toBe(utcDate("2026-05-14").toISOString());
  });

  it("cycle length is biweekly", () => {
    expect(CYCLE_LENGTH_DAYS).toBe(14);
  });

  it("defaults to a 14-day stride/end when no length is given", () => {
    const anchor = utcDate("2026-05-01");
    expect(cycleEndForStart(anchor).toISOString()).toBe(utcDate("2026-05-14").toISOString());
  });

  it("honors a weekly (7-day) stride when payFrequencyDays is threaded", () => {
    const anchor = utcDate("2026-05-01");
    // 8 days out lands in the second weekly cycle, which starts on 2026-05-08
    const target = utcDate("2026-05-09");
    expect(cycleStartForDate(anchor, target, 7).toISOString()).toBe(
      utcDate("2026-05-08").toISOString()
    );
    expect(cycleEndForStart(utcDate("2026-05-08"), 7).toISOString()).toBe(
      utcDate("2026-05-14").toISOString()
    );
  });
});
