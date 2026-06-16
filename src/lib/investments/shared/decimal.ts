/**
 * Coerce a Prisma Decimal (or plain number) to a JS number. `toNumber` treats
 * a missing value as 0; `toNullableNumber` preserves null/undefined as null.
 */
export type DecimalLike = { toNumber(): number } | number | null | undefined;

export function toNumber(value: DecimalLike): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export function toNullableNumber(value: DecimalLike): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}
