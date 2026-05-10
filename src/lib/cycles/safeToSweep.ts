import { Prisma } from "@prisma/client";

type Numeric = Prisma.Decimal | number;

export type SafeToSweepInput = {
  chequingBalance: Numeric;
  pendingExpenses?: Numeric;
  unsettledAccruals?: Numeric;
  creditCardBalanceThisCycle?: Numeric;
  sweepBuffer?: Numeric;
  carryover?: Numeric;
};

export type SafeToSweepResult = {
  amount: Prisma.Decimal;
  rawAmount: Prisma.Decimal;
  overCommitted: boolean;
  components: {
    chequingBalance: Prisma.Decimal;
    pendingExpenses: Prisma.Decimal;
    unsettledAccruals: Prisma.Decimal;
    creditCardBalanceThisCycle: Prisma.Decimal;
    sweepBuffer: Prisma.Decimal;
    carryover: Prisma.Decimal;
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
  const creditCardBalanceThisCycle = toDecimal(input.creditCardBalanceThisCycle);
  const sweepBuffer = toDecimal(input.sweepBuffer);
  const carryover = toDecimal(input.carryover);

  const raw = chequingBalance
    .sub(pendingExpenses)
    .sub(unsettledAccruals)
    .sub(creditCardBalanceThisCycle)
    .sub(sweepBuffer)
    .add(carryover);

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
      creditCardBalanceThisCycle,
      sweepBuffer,
      carryover
    }
  };
}
