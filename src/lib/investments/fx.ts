import type { Currency } from "./types";
import { getFxRate } from "@/lib/fx/rates";

export async function toCAD(amount: number, ccy: Currency): Promise<number> {
  return amount * (await getFxRate(ccy, "CAD"));
}
