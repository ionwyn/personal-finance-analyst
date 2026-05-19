import { Prisma } from "@prisma/client";

import type { Frequency } from "@/lib/cycles/types";

const CYCLES_PER_YEAR = 26;

export function computeAccrualPerCycle(
  amount: Prisma.Decimal | number,
  frequency: Frequency
): Prisma.Decimal {
  const decimal = typeof amount === "number" ? new Prisma.Decimal(amount) : amount;
  switch (frequency) {
    case "monthly":
      return decimal.div(2);
    case "annual":
      return decimal.div(CYCLES_PER_YEAR);
    case "biweekly":
      return decimal;
    case "weekly":
      return decimal.mul(2);
    default: {
      const exhaustive: never = frequency;
      throw new Error(`Unknown frequency: ${exhaustive as string}`);
    }
  }
}
