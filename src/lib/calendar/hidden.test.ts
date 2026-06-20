import { describe, expect, it } from "vitest";

import { isHidden } from "./hidden";

describe("isHidden", () => {
  it("hides an event whose id is the key or a child of it", () => {
    expect(isHidden("bill:abc:2026-06-15", ["bill:abc"])).toBe(true);
    expect(isHidden("inv:AAPL:earnings:2026-06-15", ["inv:AAPL"])).toBe(true);
    expect(isHidden("paycheck:2026-06-15", ["paycheck"])).toBe(true);
    expect(isHidden("settlement:xyz", ["settlement:xyz"])).toBe(true);
  });

  it("respects prefix boundaries so sibling keys are not hidden", () => {
    expect(isHidden("bill:abcd:2026-06-15", ["bill:abc"])).toBe(false);
    expect(isHidden("inv:AAPLX:earnings:2026-06-15", ["inv:AAPL"])).toBe(false);
  });

  it("returns false with no hidden keys", () => {
    expect(isHidden("paycheck:2026-06-15", [])).toBe(false);
  });
});
