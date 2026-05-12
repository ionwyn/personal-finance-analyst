import { describe, expect, it } from "vitest";

import { formatDate, formatPlaidDate } from "@/lib/format";

describe("date formatting", () => {
  it("preserves Plaid calendar dates stored at UTC midnight in Pacific time", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";

    try {
      const value = "2026-05-08T00:00:00.000Z";

      expect(formatDate(value)).toBe("May 7, 2026");
      expect(formatPlaidDate(value)).toBe("May 8, 2026");
    } finally {
      process.env.TZ = previousTimezone;
    }
  });
});
