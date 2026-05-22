import { Prisma } from "@prisma/client";

type Numeric = Prisma.Decimal | number;

export type SafeToSweepInput = {
  chequingBalance: Numeric;
  pendingExpenses?: Numeric;
  unsettledAccruals?: Numeric;
  creditCardBalance?: Numeric;
  sweepBuffer?: Numeric;
};

export type SafeToSweepResult = {
  amount: Prisma.Decimal;
  rawAmount: Prisma.Decimal;
  overCommitted: boolean;
  components: {
    chequingBalance: Prisma.Decimal;
    pendingExpenses: Prisma.Decimal;
    unsettledAccruals: Prisma.Decimal;
    creditCardBalance: Prisma.Decimal;
    sweepBuffer: Prisma.Decimal;
  };
};

function toDecimal(value: Numeric | undefined, fallback = 0): Prisma.Decimal {
  if (value === undefined || value === null) return new Prisma.Decimal(fallback);
  if (typeof value === "number") return new Prisma.Decimal(value);
  return value;
}

export function computeSafeToSweep(input: SafeToSweepInput): SafeToSweepResult {
  const chequingBalance = toDecimal(input.chequingBalance);
  const pendingExpenses = toDecimal(input.pendingExpenses);
  const unsettledAccruals = toDecimal(input.unsettledAccruals);
  const creditCardBalance = toDecimal(input.creditCardBalance);
  const sweepBuffer = toDecimal(input.sweepBuffer);

  const raw = chequingBalance
    .sub(pendingExpenses)
    .sub(unsettledAccruals)
    .sub(creditCardBalance)
    .sub(sweepBuffer);

  const overCommitted = raw.lt(0);
  const amount = overCommitted ? new Prisma.Decimal(0) : raw;

  return {
    amount,
    rawAmount: raw,
    overCommitted,
    components: {
      chequingBalance,
      pendingExpenses,
      unsettledAccruals,
      creditCardBalance,
      sweepBuffer,
    },
  };
}
