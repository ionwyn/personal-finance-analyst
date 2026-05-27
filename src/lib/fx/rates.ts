import { Prisma } from "@prisma/client";

import { getTwelveDataApiKey } from "@/lib/env";
import { elapsedMs, ensureRequestId, logger, safeError, withLogContext } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** The only currencies this app converts between. */
export const SUPPORTED_CURRENCIES = ["CAD", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** The base currency all stored amounts are denominated in. */
export const BASE_CURRENCY: SupportedCurrency = "CAD";

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(normalizeCurrency(code));
}

function normalizeCurrency(code: string) {
  return code.trim().toUpperCase();
}

function pairKey(sourceCurrency: string, targetCurrency: string) {
  return `${normalizeCurrency(sourceCurrency)}-${normalizeCurrency(targetCurrency)}`;
}

/**
 * Fetch a spot rate from Twelve Data's /exchange_rate endpoint.
 * Returns how many units of `target` equal one unit of `source`.
 */
async function fetchRateFromTwelveData(sourceCurrency: string, targetCurrency: string) {
  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);
  const symbol = `${source}/${target}`;

  return withLogContext({ requestId: ensureRequestId(), provider: "twelvedata" }, async () => {
    const startedAt = performance.now();
    logger.info({ symbol }, "twelvedata fx rate fetch started");

    try {
      const url = new URL("https://api.twelvedata.com/exchange_rate");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", getTwelveDataApiKey());

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Twelve Data returned HTTP ${response.status} for ${symbol}.`);
      }
      const body = (await response.json()) as { rate?: number; status?: string; message?: string };
      if (body.status === "error") {
        throw new Error(body.message || `Twelve Data error for ${symbol}.`);
      }
      const rate = body.rate;
      if (typeof rate !== "number" || !(rate > 0)) {
        throw new Error(`Twelve Data did not return a usable FX rate for ${symbol}.`);
      }

      logger.info({ duration: elapsedMs(startedAt), symbol }, "twelvedata fx rate fetch completed");
      return rate;
    } catch (error) {
      logger.error(
        { duration: elapsedMs(startedAt), symbol, error: safeError(error) },
        "twelvedata fx rate fetch failed"
      );
      throw error;
    }
  });
}

async function saveRate(sourceCurrency: string, targetCurrency: string, rate: number) {
  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);
  const pair = pairKey(source, target);
  const now = new Date();

  await prisma.fxRate.upsert({
    where: { pair },
    update: {
      sourceCurrency: source,
      targetCurrency: target,
      rate: new Prisma.Decimal(rate),
      fetchedAt: now,
    },
    create: {
      pair,
      sourceCurrency: source,
      targetCurrency: target,
      rate: new Prisma.Decimal(rate),
      fetchedAt: now,
    },
  });

  return rate;
}

/**
 * Convert-rate from `sourceCurrency` to `targetCurrency` (default CAD): how many
 * units of target equal one unit of source. Cached in the FxRate table for 24h.
 * Only CAD/USD are supported. Falls back to the inverse pair, then stale cache.
 */
export async function getFxRate(sourceCurrency: string, targetCurrency: string = BASE_CURRENCY) {
  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);
  if (source === target) return 1;

  if (!isSupportedCurrency(source) || !isSupportedCurrency(target)) {
    throw new Error(`Unsupported FX pair ${source}-${target}. Only CAD/USD are supported.`);
  }

  const pair = pairKey(source, target);
  const cached = await prisma.fxRate.findUnique({ where: { pair } });
  if (cached && Date.now() - cached.fetchedAt.getTime() <= FX_CACHE_TTL_MS) {
    return cached.rate.toNumber();
  }

  try {
    return await saveRate(source, target, await fetchRateFromTwelveData(source, target));
  } catch (directError) {
    try {
      const inverse = await fetchRateFromTwelveData(target, source);
      return await saveRate(source, target, 1 / inverse);
    } catch {
      if (cached) return cached.rate.toNumber();
      throw new Error(
        `Missing FX rate ${pair}. ${directError instanceof Error ? directError.message : ""}`.trim()
      );
    }
  }
}
