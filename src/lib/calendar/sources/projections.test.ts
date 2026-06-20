import { describe, expect, it } from "vitest";

import { cadenceOccurrences, monthlyOccurrences } from "./projections";

describe("monthlyOccurrences", () => {
  it("emits one date per month on the anchor day", () => {
    expect(monthlyOccurrences({ start: "2026-03-01", end: "2026-05-31" }, 15)).toEqual([
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
    ]);
  });

  it("clamps the anchor day to short months", () => {
    expect(monthlyOccurrences({ start: "2026-01-01", end: "2026-03-31" }, 31)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("excludes occurrences outside the window", () => {
    expect(monthlyOccurrences({ start: "2026-03-20", end: "2026-04-10" }, 15)).toEqual([]);
  });
});

describe("cadenceOccurrences", () => {
  it("steps forward from the anchor across the window", () => {
    expect(
      cadenceOccurrences({ start: "2026-06-01", end: "2026-07-15" }, "2026-06-05", 14)
    ).toEqual(["2026-06-05", "2026-06-19", "2026-07-03"]);
  });

  it("walks backward from the anchor to cover earlier dates", () => {
    const out = cadenceOccurrences({ start: "2026-05-20", end: "2026-06-10" }, "2026-06-05", 14);
    expect(out).toContain("2026-05-22");
    expect(out).toContain("2026-06-05");
    expect(out[0]).toBe("2026-05-22");
  });
});
