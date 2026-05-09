import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSnapTradeClient } from "@/lib/snaptrade/client";

const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeCurrency(code: string) {
  return code.trim().toUpperCase();
}

function pairKey(sourceCurrency: string, targetCurrency: string) {
  return `${normalizeCurrency(sourceCurrency)}-${normalizeCurrency(targetCurrency)}`;
}

async function fetchRateFromSnapTrade(sourceCurrency: string, targetCurrency: string) {
  const pair = pairKey(sourceCurrency, targetCurrency);
  const response = await getSnapTradeClient().referenceData.getCurrencyExchangeRatePair({
    currencyPair: pair
  });
  const rate = response.data.exchange_rate;
  if (!rate || rate <= 0) {
    throw new Error(`SnapTrade did not return a usable FX rate for ${pair}.`);
  }
  return rate;
}

async function saveRate(sourceCurrency: string, targetCurrency: string, rate: number) {
  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);
  const pair = pairKey(source, target);
  const now = new Date();

  await prisma.snapTradeFxRate.upsert({
    where: { pair },
    update: {
      sourceCurrency: source,
      targetCurrency: target,
      rate: new Prisma.Decimal(rate),
      fetchedAt: now
    },
    create: {
      pair,
      sourceCurrency: source,
      targetCurrency: target,
      rate: new Prisma.Decimal(rate),
      fetchedAt: now
    }
  });

  return rate;
}

export async function getFxRate(sourceCurrency: string, targetCurrency = "CAD") {
  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);
  if (source === target) return 1;

  const pair = pairKey(source, target);
  const cached = await prisma.snapTradeFxRate.findUnique({
    where: { pair }
  });

  if (cached && Date.now() - cached.fetchedAt.getTime() <= FX_CACHE_TTL_MS) {
    return cached.rate.toNumber();
  }

  try {
    return await saveRate(source, target, await fetchRateFromSnapTrade(source, target));
  } catch (directError) {
    try {
      const inverse = await fetchRateFromSnapTrade(target, source);
      return await saveRate(source, target, 1 / inverse);
    } catch {
      if (cached) return cached.rate.toNumber();
      throw new Error(
        `Missing FX rate ${pair}. ${directError instanceof Error ? directError.message : ""}`.trim()
      );
    }
  }
}
