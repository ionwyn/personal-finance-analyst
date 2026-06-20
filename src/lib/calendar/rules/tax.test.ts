import { describe, expect, it } from "vitest";

import { businessDayRoll, fromISODate, toISODate } from "@/lib/calendar/dates";

import { buildTaxEvents } from "./tax";

const events2026 = buildTaxEvents(2026);
const byType = (type: string) => events2026.find((e) => e.type === type);

describe("buildTaxEvents", () => {
  it("places the TFSA reset on Jan 1 and FHSA/RESP cutoffs on Dec 31", () => {
    expect(byType("ca-tfsa-reset")?.date).toBe("2026-01-01");
    expect(byType("ca-fhsa")?.date).toBe("2026-12-31");
    expect(byType("ca-resp")?.date).toBe("2026-12-31");
  });

  it("rolls the RRSP 60th-day deadline off the weekend", () => {
    // 2026's 60th day is Sun Mar 1 → Mon Mar 2.
    expect(byType("ca-rrsp")?.date).toBe(toISODate(businessDayRoll(fromISODate("2026-03-01"))));
    expect(byType("ca-rrsp")?.date).toBe("2026-03-02");
  });

  it("uses Apr 30 (CA) and Apr 15 (US) filing deadlines, weekend-rolled", () => {
    expect(byType("ca-t1")?.date).toBe(toISODate(businessDayRoll(fromISODate("2026-04-30"))));
    expect(byType("us-filing")?.date).toBe(toISODate(businessDayRoll(fromISODate("2026-04-15"))));
  });

  it("emits four US estimated-tax installments, the last in the next year", () => {
    const est = events2026.filter((e) => e.type === "us-estimated");
    expect(est).toHaveLength(4);
    expect(est.some((e) => e.date.startsWith("2027-01"))).toBe(true);
  });

  it("models tax-slip availability as windows with an end date", () => {
    const feb = byType("ca-slips-feb");
    expect(feb?.confidence).toBe("window");
    expect(feb?.date).toBe("2026-02-01");
    expect(feb?.endDate).toBe("2026-02-28");
  });
});
