import {
  getHistoricalUsdCad,
  getMarketDataService,
  resolvePortfolioSecurity,
  type PricePoint,
} from "@/lib/market-data";
import { prisma } from "@/lib/prisma";

import {
  externalFlows,
  mwr,
  reconstructDailyHoldings,
  restateHoldingsForSplitAdjustedPrices,
  securitiesOnlyTwr,
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
  methodology: "securities-only";
  asOf: string;
  inceptionDate: string | null;
  terminalDate: string | null;
  terminalValueCad: number | null;
  syncedValueCad: number;
  terminalDifferenceCad: number | null;
  terminalDifferencePct: number | null;
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
  twrUnavailable: Partial<Record<"3M" | "6M" | "1Y" | "ALL", string>>;
  mwr: number | null;
  coverageIssues: HistoricalCoverageIssue[];
};

type HoldingInterval = {
  symbol: string;
  startDate: string;
  endDate: string;
};

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

function allTwrUnavailableReason(
  values: Array<{ date: string; valueCad: number }>,
  flows: Array<{ date: string; amountCad: number }>
): string | null {
  const inception = values.find((value) => value.valueCad > 0);
  if (!inception) return "No positive securities valuation is available";
  const chain = values.filter((value) => value.date >= inception.date);
  const flowByDate = new Map(
    flows
      .filter((flow) => flow.date >= inception.date)
      .map((flow) => [flow.date, flow.amountCad] as const)
  );

  for (let index = 1; index < chain.length; index += 1) {
    const previous = chain[index - 1]!;
    const current = chain[index]!;
    if (current.date !== addDays(previous.date, 1)) {
      return `A continuous securities valuation is unavailable after ${previous.date}`;
    }
    const flow = flowByDate.get(current.date) ?? 0;
    const denominator = previous.valueCad + flow;
    if (denominator <= 0) {
      return (
        `${current.date} has a non-positive opening securities NAV after its ` +
        `${flow.toFixed(2)} CAD external flow; cash is intentionally excluded`
      );
    }
    if (current.valueCad === 0) {
      return `The securities NAV falls to zero on ${current.date}`;
    }
  }
  return "The all-time securities-only chain is unavailable";
}

export async function loadHistoricalPerformance(
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
    },
  });
  if (ledger.length === 0) return null;

  const performanceLedger: PerformanceLedgerEntry[] = ledger;
  const actualHoldings = reconstructDailyHoldings(performanceLedger, endDate);
  const holdings = restateHoldingsForSplitAdjustedPrices(actualHoldings, performanceLedger);
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

  const values = valueSeries(holdings, priceSeries, fx);
  const flows = externalFlows(performanceLedger);
  const terminal = values.filter((value) => value.date <= endDate).at(-1) ?? null;
  const positions = await prisma.snapTradePosition.findMany({
    where: { tenantId },
    select: { marketValueCad: true },
  });
  const syncedValueCad = positions.reduce(
    (sum, position) => sum + position.marketValueCad.toNumber(),
    0
  );
  const terminalDifferenceCad = terminal ? terminal.valueCad - syncedValueCad : null;
  const terminalDifferencePct =
    terminal && syncedValueCad > 0 ? (terminalDifferenceCad! / syncedValueCad) * 100 : null;
  const twr = {
    "3M": securitiesOnlyTwr(values, flows, "3M"),
    "6M": securitiesOnlyTwr(values, flows, "6M"),
    "1Y": securitiesOnlyTwr(values, flows, "1Y"),
    ALL: securitiesOnlyTwr(values, flows, "ALL"),
  };
  const twrUnavailable: HistoricalPerformance["twrUnavailable"] = {};
  if (twr.ALL == null) {
    twrUnavailable.ALL =
      allTwrUnavailableReason(values, flows) ?? "The all-time securities-only chain is unavailable";
  }

  return {
    methodology: "securities-only",
    asOf: endDate,
    inceptionDate: values.find((value) => value.valueCad > 0)?.date ?? null,
    terminalDate: terminal?.date ?? null,
    terminalValueCad: terminal?.valueCad ?? null,
    syncedValueCad,
    terminalDifferenceCad,
    terminalDifferencePct,
    terminalReconciled:
      terminalDifferencePct != null &&
      Math.abs(terminalDifferencePct) <= NAV_RECONCILIATION_TOLERANCE_PCT,
    resolvedSymbols: resolved.filter(Boolean).length,
    lifetimeSymbols: bySymbol.size,
    fxSource: "Bank of Canada FXUSDCAD",
    twr,
    twrUnavailable,
    mwr: terminal ? mwr(flows, terminal.valueCad, terminal.date) : null,
    coverageIssues: coverageIssues.sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) || left.symbol.localeCompare(right.symbol)
    ),
  };
}
