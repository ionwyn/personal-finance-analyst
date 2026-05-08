import type { Currency } from "./types";

export const FX_USD_TO_CAD = 1.362;

export function toCAD(amount: number, ccy: Currency): number {
  return ccy === "USD" ? amount * FX_USD_TO_CAD : amount;
}
