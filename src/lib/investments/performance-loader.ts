import {
  getHistoricalUsdCad,
  getMarketDataService,
  resolvePortfolioSecurity,
  type PricePoint,
} from "@/lib/market-data";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import {
  addCashToValueSeries,
  externalFlows,
  mwr,
  reconstructDailyCash,
  reconstructDailyHoldings,
  restateHoldingsForSplitAdjustedPrices,
  twr as computeTwr,
  twrIndexSeries,
  valueSeries,
  type DailyHoldings,
  type PerformanceLedgerEntry,
  type SecurityPriceSeries,
} from "./performance";

const DAY_MS = 24 * 60 * 60 * 1000;
const COVERAGE_BUFFER_DAYS = 7;
const CONCURRENCY = 6;
const NAV_RECONCILIATION_TOLERANCE_PCT = 1;

export type HistoricalCoverageIssue = {
  kind: "price" | "fx" | "metadata";
  symbol: string;
  startDate: string;
  endDate: string;
  message: string;
};

export type HistoricalPerformance = {
  methodology: "total-portfolio";
  asOf: string;
  inceptionDate: string | null;
  terminalDate: string | null;
  terminalValueCad: number | null;
  terminalSecuritiesValueCad: number | null;
  terminalCashCad: number | null;
  syncedValueCad: number;
  syncedSecuritiesValueCad: number;
  syncedCashCad: number;
  terminalDifferenceCad: number | null;
  terminalDifferencePct: number | null;
  cashDifferenceCad: number | null;
  terminalReconciled: boolean;
  resolvedSymbols: number;
  lifetimeSymbols: number;
  fxSource: "Bank of Canada FXUSDCAD";
  twr: {
    "3M": number | null;
    "6M": number | null;
    "1Y": number | null;
    ALL: number | null;
  };
  mwr: number | null;
  series: { date: string; portfolio: number; spx: number | null; tsx: number | null }[];
  coverageIssues: HistoricalCoverageIssue[];
};

type HoldingInterval = {
  symbol: string;
  startDate: string;
  endDate: string;
};

function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function decimalNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function coverageIssuesFromJson(value: Prisma.JsonValue): HistoricalCoverageIssue[] {
  return Array.isArray(value) ? (value as HistoricalCoverageIssue[]) : [];
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]!);
      }
    })
  );
  return results;
}

function holdingIntervals(holdings: DailyHoldings[]): HoldingInterval[] {
  const open = new Map<string, string>();
  const previous = new Set<string>();
  const intervals: HoldingInterval[] = [];

  for (const holding of holdings) {
    const current = new Set(
      Object.entries(holding.units)
        .filter(([, units]) => Math.abs(units) > 1e-10)
        .map(([symbol]) => symbol)
    );

    for (const symbol of current) {
      if (!previous.has(symbol)) open.set(symbol, holding.date);
    }
    for (const symbol of previous) {
      if (!current.has(symbol)) {
        intervals.push({
          symbol,
          startDate: open.get(symbol)!,
          endDate: addDays(holding.date, -1),
        });
        open.delete(symbol);
      }
    }

    previous.clear();
    for (const symbol of current) previous.add(symbol);
  }

  const lastDate = holdings.at(-1)?.date;
  if (lastDate) {
    for (const [symbol, startDate] of open) {
      intervals.push({ symbol, startDate, endDate: lastDate });
    }
  }
  return intervals;
}

function coverageIssuesForSeries(
  intervals: HoldingInterval[],
  points: PricePoint[]
): HistoricalCoverageIssue[] {
  const issues: HistoricalCoverageIssue[] = [];
  for (const interval of intervals) {
    const throughEnd = points.filter((point) => point.date <= interval.endDate);
    const beforeStart = throughEnd.filter((point) => point.date <= interval.startDate).at(-1);
    const latest = throughEnd.at(-1);

    if (!beforeStart || daysBetween(beforeStart.date, interval.startDate) > COVERAGE_BUFFER_DAYS) {
      issues.push({
        kind: "price",
        symbol: interval.symbol,
        startDate: interval.startDate,
        endDate: beforeStart ? interval.startDate : (latest?.date ?? interval.endDate),
        message: `No usable close at the start of the ${interval.symbol} holding interval`,
      });
      continue;
    }

    if (!latest || daysBetween(latest.date, interval.endDate) > COVERAGE_BUFFER_DAYS) {
      issues.push({
        kind: "price",
        symbol: interval.symbol,
        startDate: latest ? addDays(latest.date, 1) : interval.startDate,
        endDate: interval.endDate,
        message: `Price history ends before the ${interval.symbol} holding interval`,
      });
    }
  }
  return issues;
}

function fxCoverageIssues(
  intervals: HoldingInterval[],
  points: Array<{ date: string; rate: number }>
): HistoricalCoverageIssue[] {
  const issues: HistoricalCoverageIssue[] = [];
  for (const interval of intervals) {
    const throughEnd = points.filter((point) => point.date <= interval.endDate);
    const beforeStart = throughEnd.filter((point) => point.date <= interval.startDate).at(-1);
    const latest = throughEnd.at(-1);
    if (!beforeStart || daysBetween(beforeStart.date, interval.startDate) > COVERAGE_BUFFER_DAYS) {
      issues.push({
        kind: "fx",
        symbol: interval.symbol,
        startDate: interval.startDate,
        endDate: interval.endDate,
        message: `USD/CAD is unavailable at the start of the ${interval.symbol} holding interval`,
      });
    } else if (!latest || daysBetween(latest.date, interval.endDate) > COVERAGE_BUFFER_DAYS) {
      issues.push({
        kind: "fx",
        symbol: interval.symbol,
        startDate: latest ? addDays(latest.date, 1) : interval.startDate,
        endDate: interval.endDate,
        message: `USD/CAD ends before the ${interval.symbol} holding interval`,
      });
    }
  }
  return issues;
}

export async function loadHistoricalPerformance(
  tenantId: string,
  endDate = new Date().toISOString().slice(0, 10)
): Promise<HistoricalPerformance | null> {
  const stored = await loadStoredHistoricalPerformance(tenantId, endDate);
  if (stored) return stored;
  return refreshHistoricalPerformance(tenantId, endDate);
}

async function loadStoredHistoricalPerformance(
  tenantId: string,
  endDate: string
): Promise<HistoricalPerformance | null> {
  const summary = await prisma.portfolioPerformanceSummary.findUnique({
    where: { tenantId_asOf: { tenantId, asOf: dateOnly(endDate) } },
    include: { points: { orderBy: { date: "asc" } } },
  });
  if (!summary) return null;

  return {
    methodology: "total-portfolio",
    asOf: isoDate(summary.asOf)!,
    inceptionDate: isoDate(summary.inceptionDate),
    terminalDate: isoDate(summary.terminalDate),
    terminalValueCad: decimalNumber(summary.terminalValueCad),
    terminalSecuritiesValueCad: decimalNumber(summary.terminalSecuritiesValueCad),
    terminalCashCad: decimalNumber(summary.terminalCashCad),
    syncedValueCad: summary.syncedValueCad.toNumber(),
    syncedSecuritiesValueCad: summary.syncedSecuritiesValueCad.toNumber(),
    syncedCashCad: summary.syncedCashCad.toNumber(),
    terminalDifferenceCad: decimalNumber(summary.terminalDifferenceCad),
    terminalDifferencePct: decimalNumber(summary.terminalDifferencePct),
    cashDifferenceCad: decimalNumber(summary.cashDifferenceCad),
    terminalReconciled: summary.terminalReconciled,
    resolvedSymbols: summary.resolvedSymbols,
    lifetimeSymbols: summary.lifetimeSymbols,
    fxSource: "Bank of Canada FXUSDCAD",
    twr: {
      "3M": decimalNumber(summary.twr3M),
      "6M": decimalNumber(summary.twr6M),
      "1Y": decimalNumber(summary.twr1Y),
      ALL: decimalNumber(summary.twrAll),
    },
    mwr: decimalNumber(summary.mwr),
    series: summary.points.map((point) => ({
      date: isoDate(point.date)!,
      portfolio: point.portfolio.toNumber(),
      spx: decimalNumber(point.spx),
      tsx: decimalNumber(point.tsx),
    })),
    coverageIssues: coverageIssuesFromJson(summary.coverageIssues),
  };
}

export async function refreshHistoricalPerformance(
  tenantId: string,
  endDate = new Date().toISOString().slice(0, 10)
): Promise<HistoricalPerformance | null> {
  const ledger = await prisma.brokerLedgerEntry.findMany({
    where: { tenantId },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    select: {
      tradeDate: true,
      activityType: true,
      activitySubType: true,
      symbolNorm: true,
      units: true,
      cashAmount: true,
      accountId: true,
    },
  });
  if (ledger.length === 0) return null;

  const performanceLedger: PerformanceLedgerEntry[] = ledger;
  const actualHoldings = reconstructDailyHoldings(performanceLedger, endDate);
  const holdings = restateHoldingsForSplitAdjustedPrices(actualHoldings, performanceLedger);
  const cash = reconstructDailyCash(performanceLedger, endDate);
  const intervals = holdingIntervals(holdings);
  const bySymbol = new Map<string, HoldingInterval[]>();
  for (const interval of intervals) {
    const symbolIntervals = bySymbol.get(interval.symbol) ?? [];
    symbolIntervals.push(interval);
    bySymbol.set(interval.symbol, symbolIntervals);
  }

  const coverageIssues: HistoricalCoverageIssue[] = [];
  const service = getMarketDataService();
  const resolved = await mapLimit([...bySymbol.entries()], CONCURRENCY, async ([symbol, spans]) => {
    const security = resolvePortfolioSecurity(symbol);
    if (!security) {
      coverageIssues.push({
        kind: "metadata",
        symbol,
        startDate: spans[0]!.startDate,
        endDate: spans.at(-1)!.endDate,
        message: `No market symbol and currency mapping exists for ${symbol}`,
      });
      return null;
    }

    const range = {
      startDate: addDays(spans[0]!.startDate, -COVERAGE_BUFFER_DAYS),
      endDate: addDays(spans.at(-1)!.endDate, COVERAGE_BUFFER_DAYS),
    };
    const today = new Date().toISOString().slice(0, 10);
    if (range.endDate > today) range.endDate = today;
    const points = await service
      .getTimeSeriesRange(security.marketSymbol, range)
      .catch(() => [] as PricePoint[]);
    coverageIssues.push(...coverageIssuesForSeries(spans, points));
    return {
      symbol,
      currency: security.currency,
      points,
    };
  });

  const priceSeries: Record<string, SecurityPriceSeries> = {};
  for (const series of resolved) {
    if (!series) continue;
    priceSeries[series.symbol] = {
      currency: series.currency,
      points: series.points,
    };
  }

  const usdIntervals = intervals.filter(
    (interval) => resolvePortfolioSecurity(interval.symbol)?.currency === "USD"
  );
  const firstUsd = usdIntervals
    .map((interval) => interval.startDate)
    .sort((left, right) => left.localeCompare(right))[0];
  const lastUsd = usdIntervals
    .map((interval) => interval.endDate)
    .sort((left, right) => left.localeCompare(right))
    .at(-1);
  const fx =
    firstUsd && lastUsd
      ? await getHistoricalUsdCad({
          startDate: addDays(firstUsd, -COVERAGE_BUFFER_DAYS),
          endDate: lastUsd,
        })
      : [];
  coverageIssues.push(...fxCoverageIssues(usdIntervals, fx));

  const securityValues = valueSeries(holdings, priceSeries, fx);
  const values = addCashToValueSeries(securityValues, cash);
  const flows = externalFlows(performanceLedger);
  const terminal = values.filter((value) => value.date <= endDate).at(-1) ?? null;
  const terminalSecurities = securityValues.filter((value) => value.date <= endDate).at(-1) ?? null;
  const terminalCash = cash.filter((value) => value.date <= endDate).at(-1) ?? null;
  const accountIds = [
    ...new Set(ledger.map((entry) => entry.accountId).filter((id): id is string => Boolean(id))),
  ];
  const positions = await prisma.snapTradePosition.findMany({
    where: { tenantId, accountId: { in: accountIds } },
    select: { marketValueCad: true },
  });
  const syncedSecuritiesValueCad = positions.reduce(
    (sum, position) => sum + position.marketValueCad.toNumber(),
    0
  );
  const cashBalances = await prisma.snapTradeCashBalance.findMany({
    where: { tenantId, accountId: { in: accountIds } },
    select: { cashCad: true },
  });
  const syncedCashCad = cashBalances.reduce((sum, balance) => sum + balance.cashCad.toNumber(), 0);
  const syncedValueCad = syncedSecuritiesValueCad + syncedCashCad;
  const terminalDifferenceCad = terminal ? terminal.valueCad - syncedValueCad : null;
  const terminalDifferencePct =
    terminal && syncedValueCad > 0 ? (terminalDifferenceCad! / syncedValueCad) * 100 : null;
  const cashDifferenceCad = terminalCash != null ? terminalCash.cashCad - syncedCashCad : null;
  const twr = {
    "3M": computeTwr(values, flows, "3M"),
    "6M": computeTwr(values, flows, "6M"),
    "1Y": computeTwr(values, flows, "1Y"),
    ALL: computeTwr(values, flows, "ALL"),
  };

  const indexSeries = twrIndexSeries(values, flows);
  const seriesStart = indexSeries[0]?.date;
  const seriesEnd = indexSeries.at(-1)?.date ?? endDate;

  const [spxRaw, tsxRaw] = seriesStart
    ? await Promise.all([
        service
          .getTimeSeriesRange("^GSPC", { startDate: seriesStart, endDate: seriesEnd })
          .catch(() => [] as PricePoint[]),
        service
          .getTimeSeriesRange("^GSPTSE", { startDate: seriesStart, endDate: seriesEnd })
          .catch(() => [] as PricePoint[]),
      ])
    : [[] as PricePoint[], [] as PricePoint[]];

  const spxByDate = new Map(spxRaw.map((p) => [p.date, p.close]));
  const tsxByDate = new Map(tsxRaw.map((p) => [p.date, p.close]));

  function forwardFill(byDate: Map<string, number>, dates: string[]): (number | null)[] {
    let last: number | null = null;
    return dates.map((date) => {
      const v = byDate.get(date);
      if (v != null) last = v;
      return last;
    });
  }

  const indexDates = indexSeries.map((p) => p.date);
  const spxAligned = forwardFill(spxByDate, indexDates);
  const tsxAligned = forwardFill(tsxByDate, indexDates);

  const series = indexSeries.map((p, i) => ({
    date: p.date,
    portfolio: p.index,
    spx: spxAligned[i] ?? null,
    tsx: tsxAligned[i] ?? null,
  }));

  const result: HistoricalPerformance = {
    methodology: "total-portfolio",
    asOf: endDate,
    inceptionDate: values[0]?.date ?? null,
    terminalDate: terminal?.date ?? null,
    terminalValueCad: terminal?.valueCad ?? null,
    terminalSecuritiesValueCad: terminalSecurities?.valueCad ?? null,
    terminalCashCad: terminalCash?.cashCad ?? null,
    syncedValueCad,
    syncedSecuritiesValueCad,
    syncedCashCad,
    terminalDifferenceCad,
    terminalDifferencePct,
    cashDifferenceCad,
    terminalReconciled:
      terminalDifferencePct != null &&
      Math.abs(terminalDifferencePct) <= NAV_RECONCILIATION_TOLERANCE_PCT,
    resolvedSymbols: resolved.filter(Boolean).length,
    lifetimeSymbols: bySymbol.size,
    fxSource: "Bank of Canada FXUSDCAD",
    twr,
    mwr: terminal ? mwr(flows, terminal.valueCad, terminal.date) : null,
    series,
    coverageIssues: coverageIssues.sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) || left.symbol.localeCompare(right.symbol)
    ),
  };
  await saveHistoricalPerformance(tenantId, result, values, securityValues, cash);
  return result;
}

async function saveHistoricalPerformance(
  tenantId: string,
  result: HistoricalPerformance,
  values: { date: string; valueCad: number }[],
  securityValues: { date: string; valueCad: number }[],
  cash: { date: string; cashCad: number }[]
) {
  const valueByDate = new Map(values.map((point) => [point.date, point.valueCad]));
  const securitiesByDate = new Map(securityValues.map((point) => [point.date, point.valueCad]));
  const cashByDate = new Map(cash.map((point) => [point.date, point.cashCad]));

  await prisma.$transaction(async (tx) => {
    const summary = await tx.portfolioPerformanceSummary.upsert({
      where: { tenantId_asOf: { tenantId, asOf: dateOnly(result.asOf) } },
      create: {
        tenantId,
        asOf: dateOnly(result.asOf),
        inceptionDate: result.inceptionDate ? dateOnly(result.inceptionDate) : null,
        terminalDate: result.terminalDate ? dateOnly(result.terminalDate) : null,
        terminalValueCad: result.terminalValueCad,
        terminalSecuritiesValueCad: result.terminalSecuritiesValueCad,
        terminalCashCad: result.terminalCashCad,
        syncedValueCad: result.syncedValueCad,
        syncedSecuritiesValueCad: result.syncedSecuritiesValueCad,
        syncedCashCad: result.syncedCashCad,
        terminalDifferenceCad: result.terminalDifferenceCad,
        terminalDifferencePct: result.terminalDifferencePct,
        cashDifferenceCad: result.cashDifferenceCad,
        terminalReconciled: result.terminalReconciled,
        resolvedSymbols: result.resolvedSymbols,
        lifetimeSymbols: result.lifetimeSymbols,
        fxSource: result.fxSource,
        twr3M: result.twr["3M"],
        twr6M: result.twr["6M"],
        twr1Y: result.twr["1Y"],
        twrAll: result.twr.ALL,
        mwr: result.mwr,
        coverageIssues: result.coverageIssues as unknown as Prisma.InputJsonValue,
      },
      update: {
        inceptionDate: result.inceptionDate ? dateOnly(result.inceptionDate) : null,
        terminalDate: result.terminalDate ? dateOnly(result.terminalDate) : null,
        terminalValueCad: result.terminalValueCad,
        terminalSecuritiesValueCad: result.terminalSecuritiesValueCad,
        terminalCashCad: result.terminalCashCad,
        syncedValueCad: result.syncedValueCad,
        syncedSecuritiesValueCad: result.syncedSecuritiesValueCad,
        syncedCashCad: result.syncedCashCad,
        terminalDifferenceCad: result.terminalDifferenceCad,
        terminalDifferencePct: result.terminalDifferencePct,
        cashDifferenceCad: result.cashDifferenceCad,
        terminalReconciled: result.terminalReconciled,
        resolvedSymbols: result.resolvedSymbols,
        lifetimeSymbols: result.lifetimeSymbols,
        fxSource: result.fxSource,
        twr3M: result.twr["3M"],
        twr6M: result.twr["6M"],
        twr1Y: result.twr["1Y"],
        twrAll: result.twr.ALL,
        mwr: result.mwr,
        coverageIssues: result.coverageIssues as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
      },
    });

    await tx.portfolioPerformancePoint.deleteMany({ where: { summaryId: summary.id } });
    if (result.series.length > 0) {
      await tx.portfolioPerformancePoint.createMany({
        data: result.series.map((point) => ({
          tenantId,
          summaryId: summary.id,
          date: dateOnly(point.date),
          portfolio: point.portfolio,
          spx: point.spx,
          tsx: point.tsx,
          valueCad: valueByDate.get(point.date) ?? null,
          securitiesValueCad: securitiesByDate.get(point.date) ?? null,
          cashCad: cashByDate.get(point.date) ?? null,
        })),
      });
    }
  });
}
