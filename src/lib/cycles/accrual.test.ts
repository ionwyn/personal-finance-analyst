import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeAccrualPerCycle } from "@/lib/cycles/accrual";

describe("computeAccrualPerCycle", () => {
  it("splits monthly amounts across two cycles", () => {
    expect(computeAccrualPerCycle(new Prisma.Decimal(2000), "monthly").toString()).toBe("1000");
  });

  it("divides annual amounts across 26 cycles", () => {
    const result = computeAccrualPerCycle(new Prisma.Decimal(2600), "annual");
    expect(result.toString()).toBe("100");
  });

  it("returns biweekly amounts as-is", () => {
    expect(computeAccrualPerCycle(new Prisma.Decimal(150), "biweekly").toString()).toBe("150");
  });

  it("doubles weekly amounts", () => {
    expect(computeAccrualPerCycle(new Prisma.Decimal(75), "weekly").toString()).toBe("150");
  });
});
