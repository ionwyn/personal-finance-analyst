import {
  BASE_CURRENCY,
  getFxRate,
  isSupportedCurrency,
  type SupportedCurrency,
} from "@/lib/fx/rates";
import { prisma } from "@/lib/prisma";

export type DisplayFx = { currency: SupportedCurrency; rate: number };

/**
 * Resolve a tenant's display currency + the conversion rate FROM the base
 * currency (CAD) TO that display currency. CAD → rate 1. Resilient: if the FX
 * lookup fails (e.g. no API key), falls back to CAD so the app still renders.
 */
export async function resolveDisplayCurrency(
  tenantId: string | null | undefined
): Promise<DisplayFx> {
  if (!tenantId) return { currency: BASE_CURRENCY, rate: 1 };

  const settings = await prisma.userSettings.findUnique({
    where: { tenantId },
    select: { displayCurrency: true },
  });
  const pref = settings?.displayCurrency ?? BASE_CURRENCY;
  const currency: SupportedCurrency = isSupportedCurrency(pref) ? pref : BASE_CURRENCY;
  if (currency === BASE_CURRENCY) return { currency, rate: 1 };

  try {
    const rate = await getFxRate(BASE_CURRENCY, currency);
    return { currency, rate };
  } catch {
    return { currency: BASE_CURRENCY, rate: 1 };
  }
}
