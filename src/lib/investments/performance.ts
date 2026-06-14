const DAY_MS = 24 * 60 * 60 * 1000;
const UNIT_SCALE = 100_000_000;
const XIRR_MIN_RATE = -0.999999;
const XIRR_MAX_RATE = 1_000_000;
const XIRR_SCAN_STEPS = 1024;
const XIRR_MAX_ITERATIONS = 256;

export type NumericInput =
  | number
  | string
  | {
      toString(): string;
    };

export type PerformanceLedgerEntry = {
  tradeDate: Date | string;
  activityType: string;
  activitySubType?: string | null;
  symbolNorm?: string | null;
  units: NumericInput;
  cashAmount?: NumericInput | null;
};

export type DailyHoldings = {
  date: string;
  units: Record<string, number>;
};

export type PriceObservation = {
  date: Date | string;
  close: number;
};

export type SecurityPriceSeries = {
  currency: string;
  points: PriceObservation[];
};

export type FxObservation = {
  date: Date | string;
  rate: number;
};

export type DailyValue = {
  date: string;
  valueCad: number;
};

export type ExternalFlow = {
  date: string;
  amountCad: number;
};

export type PerformanceWindow = "3M" | "6M" | "1Y" | "ALL";

type PreparedObservation = {
  date: string;
  value: number;
};

type ObservationCursor = {
  points: PreparedObservation[];
  index: number;
  last: number | null;
};

type InvestorCashFlow = {
  date: string;
  amount: number;
};

function numericValue(value: NumericInput, label: string): number {
  const result = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(result)) {
    throw new Error(`${label} must be a finite number`);
  }
  return result;
}

function scaledUnits(value: NumericInput): bigint {
  const units = numericValue(value, "units");
  const unrounded = units * UNIT_SCALE;
  const scaled = Math.round(unrounded);
  if (Math.abs(unrounded - scaled) > 0.000001) {
    throw new Error("units may have at most 8 decimal places");
  }
  if (!Number.isSafeInteger(scaled)) {
    throw new Error("units exceed the supported 8-decimal precision range");
  }
  return BigInt(scaled);
}

function unitsNumber(value: bigint): number {
  return Number(value) / UNIT_SCALE;
}

function dateParts(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return { year, month, day, time };
}

export function calendarDate(value: Date | string): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new Error("Invalid calendar date");
    }
    return value.toISOString().slice(0, 10);
  }

  dateParts(value);
  return value;
}

function addCalendarDays(value: string, days: number): string {
  const { time } = dateParts(value);
  return new Date(time + days * DAY_MS).toISOString().slice(0, 10);
}

function calendarDaysBetween(start: string, end: string): number {
  return (dateParts(end).time - dateParts(start).time) / DAY_MS;
}

function subtractMonths(value: string, months: number): string {
  const { year, month, day } = dateParts(value);
  const targetStart = new Date(Date.UTC(year, month - 1 - months, 1));
  const targetYear = targetStart.getUTCFullYear();
  const targetMonth = targetStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function subtractYears(value: string, years: number): string {
  const { year, month, day } = dateParts(value);
  const lastDay = new Date(Date.UTC(year - years, month, 0)).getUTCDate();
  return new Date(Date.UTC(year - years, month - 1, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function normalizedSymbol(value: string | null | undefined): string | null {
  const result = value?.trim().toUpperCase() ?? "";
  return result || null;
}

export function isUnitAffectingEntry(
  entry: Pick<PerformanceLedgerEntry, "activityType" | "activitySubType">
): boolean {
  return (
    (entry.activityType === "Trade" &&
      (entry.activitySubType === "BUY" || entry.activitySubType === "SELL")) ||
    entry.activityType === "StockDividend" ||
    entry.activityType === "InternalSecurityTransfer" ||
    (entry.activityType === "LegacyCorporateAction" &&
      (entry.activitySubType === "SPLIT" || entry.activitySubType === "NAME_CHANGE"))
  );
}

export function reconstructDailyHoldings(
  ledger: PerformanceLedgerEntry[],
  endDate: Date | string
): DailyHoldings[] {
  if (ledger.length === 0) return [];

  const normalized = ledger
    .map((entry, index) => ({
      entry,
      index,
      date: calendarDate(entry.tradeDate),
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index);

  const start = normalized[0]!.date;
  const end = calendarDate(endDate);
  if (end < start) return [];

  const entriesByDate = new Map<string, PerformanceLedgerEntry[]>();
  for (const item of normalized) {
    if (item.date > end) continue;
    const entries = entriesByDate.get(item.date) ?? [];
    entries.push(item.entry);
    entriesByDate.set(item.date, entries);
  }

  const running = new Map<string, bigint>();
  const snapshots: DailyHoldings[] = [];

  for (let date = start; date <= end; date = addCalendarDays(date, 1)) {
    for (const entry of entriesByDate.get(date) ?? []) {
      if (!isUnitAffectingEntry(entry)) continue;

      const symbol = normalizedSymbol(entry.symbolNorm);
      if (!symbol) {
        throw new Error(`Unit-affecting ledger entry on ${date} has no normalized symbol`);
      }

      const next = (running.get(symbol) ?? 0n) + scaledUnits(entry.units);
      if (next === 0n) {
        running.delete(symbol);
      } else {
        running.set(symbol, next);
      }
    }

    snapshots.push({
      date,
      units: Object.fromEntries(
        [...running.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([symbol, units]) => [symbol, unitsNumber(units)])
      ),
    });
  }

  return snapshots;
}

/**
 * Yahoo daily closes are adjusted for splits but not for cash distributions.
 * Restate pre-split ledger units to the provider's current-share basis so a
 * recorded split and a split-adjusted close are not both applied to NAV.
 */
export function restateHoldingsForSplitAdjustedPrices(
  holdings: DailyHoldings[],
  ledger: PerformanceLedgerEntry[]
): DailyHoldings[] {
  const normalized = ledger
    .map((entry, index) => ({
      entry,
      index,
      date: calendarDate(entry.tradeDate),
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index);
  const running = new Map<string, bigint>();
  const splits: Array<{ symbol: string; date: string; factor: number }> = [];

  for (const item of normalized) {
    if (!isUnitAffectingEntry(item.entry)) continue;
    const symbol = normalizedSymbol(item.entry.symbolNorm);
    if (!symbol) {
      throw new Error(`Unit-affecting ledger entry on ${item.date} has no normalized symbol`);
    }

    const before = running.get(symbol) ?? 0n;
    const delta = scaledUnits(item.entry.units);
    const after = before + delta;
    if (
      item.entry.activityType === "LegacyCorporateAction" &&
      item.entry.activitySubType === "SPLIT"
    ) {
      const beforeUnits = unitsNumber(before);
      const afterUnits = unitsNumber(after);
      const factor = afterUnits / beforeUnits;
      if (
        beforeUnits === 0 ||
        !Number.isFinite(factor) ||
        factor <= 0 ||
        Math.abs(factor - 1) < 1e-12
      ) {
        throw new Error(`Cannot derive split factor for ${symbol} on ${item.date}`);
      }
      splits.push({ symbol, date: item.date, factor });
    }

    if (after === 0n) running.delete(symbol);
    else running.set(symbol, after);
  }

  if (splits.length === 0) {
    return holdings.map((holding) => ({ ...holding, units: { ...holding.units } }));
  }

  return holdings.map((holding) => {
    const date = calendarDate(holding.date);
    const units = { ...holding.units };
    for (const split of splits) {
      if (date >= split.date || units[split.symbol] == null) continue;
      units[split.symbol] *= split.factor;
    }
    return { date, units };
  });
}

function prepareObservations(
  observations: Array<{ date: Date | string; value: number }>,
  label: string
): PreparedObservation[] {
  const prepared = observations
    .map((observation) => {
      if (!Number.isFinite(observation.value) || observation.value <= 0) {
        throw new Error(`${label} on ${calendarDate(observation.date)} must be positive`);
      }
      return {
        date: calendarDate(observation.date),
        value: observation.value,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  for (let index = 1; index < prepared.length; index += 1) {
    if (prepared[index - 1]!.date === prepared[index]!.date) {
      throw new Error(`${label} contains duplicate date ${prepared[index]!.date}`);
    }
  }
  return prepared;
}

function cursor(points: PreparedObservation[]): ObservationCursor {
  return { points, index: 0, last: null };
}

function advance(observationCursor: ObservationCursor, date: string): number | null {
  while (
    observationCursor.index < observationCursor.points.length &&
    observationCursor.points[observationCursor.index]!.date <= date
  ) {
    observationCursor.last = observationCursor.points[observationCursor.index]!.value;
    observationCursor.index += 1;
  }
  return observationCursor.last;
}

export function valueSeries(
  holdings: DailyHoldings[],
  priceSeries: Record<string, SecurityPriceSeries>,
  fxSeries: FxObservation[]
): DailyValue[] {
  const normalizedHoldings = holdings
    .map((holding) => ({ ...holding, date: calendarDate(holding.date) }))
    .sort((left, right) => left.date.localeCompare(right.date));

  for (let index = 1; index < normalizedHoldings.length; index += 1) {
    if (normalizedHoldings[index - 1]!.date === normalizedHoldings[index]!.date) {
      throw new Error(`Holdings contain duplicate date ${normalizedHoldings[index]!.date}`);
    }
  }

  const prices = new Map<
    string,
    {
      currency: string;
      cursor: ObservationCursor;
    }
  >();
  for (const [rawSymbol, series] of Object.entries(priceSeries)) {
    const symbol = normalizedSymbol(rawSymbol);
    if (!symbol) throw new Error("Price series contains a blank symbol");
    const currency = series.currency.trim().toUpperCase();
    if (currency !== "CAD" && currency !== "USD") {
      throw new Error(`Unsupported price currency for ${symbol}: ${series.currency}`);
    }
    prices.set(symbol, {
      currency,
      cursor: cursor(
        prepareObservations(
          series.points.map((point) => ({ date: point.date, value: point.close })),
          `${symbol} close`
        )
      ),
    });
  }

  const fxCursor = cursor(
    prepareObservations(
      fxSeries.map((point) => ({ date: point.date, value: point.rate })),
      "USD/CAD rate"
    )
  );
  const values: DailyValue[] = [];

  for (const holding of normalizedHoldings) {
    const currentPrices = new Map<string, number | null>();
    for (const [symbol, series] of prices) {
      currentPrices.set(symbol, advance(series.cursor, holding.date));
    }
    const currentFx = advance(fxCursor, holding.date);

    let complete = true;
    let valueCad = 0;
    for (const [rawSymbol, units] of Object.entries(holding.units)) {
      if (!Number.isFinite(units)) {
        throw new Error(`Units for ${rawSymbol} on ${holding.date} must be finite`);
      }
      if (units === 0) continue;

      const symbol = normalizedSymbol(rawSymbol);
      const series = symbol ? prices.get(symbol) : null;
      const close = symbol ? currentPrices.get(symbol) : null;
      if (!series || close == null || (series.currency === "USD" && currentFx == null)) {
        complete = false;
        break;
      }

      valueCad += units * close * (series.currency === "USD" ? currentFx! : 1);
    }

    if (complete && Number.isFinite(valueCad)) {
      values.push({ date: holding.date, valueCad });
    }
  }

  return values;
}

export function externalFlows(ledger: PerformanceLedgerEntry[]): ExternalFlow[] {
  const amounts = new Map<string, number>();

  for (const entry of ledger) {
    if (entry.activityType !== "MoneyMovement" || entry.activitySubType !== "EFT") continue;
    if (entry.cashAmount == null) {
      throw new Error(`EFT ledger entry on ${calendarDate(entry.tradeDate)} has no cash amount`);
    }

    const date = calendarDate(entry.tradeDate);
    const portfolioAmount = -numericValue(entry.cashAmount, "cashAmount");
    amounts.set(date, (amounts.get(date) ?? 0) + portfolioAmount);
  }

  return [...amounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, amountCad]) => ({ date, amountCad }));
}

function aggregateFlows(flows: ExternalFlow[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const flow of flows) {
    if (!Number.isFinite(flow.amountCad)) {
      throw new Error(`External flow on ${calendarDate(flow.date)} must be finite`);
    }
    const date = calendarDate(flow.date);
    result.set(date, (result.get(date) ?? 0) + flow.amountCad);
  }
  return result;
}

function windowBoundary(endDate: string, window: Exclude<PerformanceWindow, "ALL">): string {
  if (window === "3M") return subtractMonths(endDate, 3);
  if (window === "6M") return subtractMonths(endDate, 6);
  return subtractYears(endDate, 1);
}

export function twr(
  values: DailyValue[],
  flows: ExternalFlow[],
  window: PerformanceWindow
): number | null {
  if (values.length < 2) return null;

  const ordered = values
    .map((value) => {
      if (!Number.isFinite(value.valueCad) || value.valueCad < 0) {
        throw new Error(`Portfolio value on ${calendarDate(value.date)} must be non-negative`);
      }
      return { ...value, date: calendarDate(value.date) };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1]!.date === ordered[index]!.date) {
      throw new Error(`Value series contains duplicate date ${ordered[index]!.date}`);
    }
  }

  let baselineIndex = 0;
  if (window !== "ALL") {
    const boundary = windowBoundary(ordered.at(-1)!.date, window);
    baselineIndex = -1;
    for (let index = 0; index < ordered.length; index += 1) {
      if (ordered[index]!.date <= boundary) baselineIndex = index;
      else break;
    }
    if (baselineIndex < 0 || baselineIndex === ordered.length - 1) return null;
  }

  const flowByDate = aggregateFlows(flows);
  const firstDate = ordered[0]!.date;
  const lastDate = ordered.at(-1)!.date;
  if ([...flowByDate.keys()].some((date) => date > lastDate)) return null;
  if (window === "ALL" && [...flowByDate.keys()].some((date) => date < firstDate)) return null;

  let logReturn = 0;
  if (window === "ALL") {
    const openingFlow = flowByDate.get(firstDate) ?? 0;
    if (openingFlow !== 0) {
      if (openingFlow < 0) return null;
      const openingFactor = ordered[0]!.valueCad / openingFlow;
      if (!Number.isFinite(openingFactor) || openingFactor < 0) return null;
      if (openingFactor === 0) return -1;
      logReturn += Math.log(openingFactor);
    }
  }

  for (let index = baselineIndex + 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    if (current.date !== addCalendarDays(previous.date, 1)) return null;

    const denominator = previous.valueCad + (flowByDate.get(current.date) ?? 0);
    if (!Number.isFinite(denominator) || denominator <= 0) return null;

    const factor = current.valueCad / denominator;
    if (!Number.isFinite(factor) || factor < 0) return null;
    if (factor === 0) return -1;
    logReturn += Math.log(factor);
  }

  return Math.expm1(logReturn);
}

/**
 * Cash is outside the reconstructed NAV. For ALL, begin at the first positive
 * securities valuation and exclude earlier funding that had not yet purchased
 * a security. Shorter windows retain the normal exact-boundary behavior.
 */
export function securitiesOnlyTwr(
  values: DailyValue[],
  flows: ExternalFlow[],
  window: PerformanceWindow
): number | null {
  if (window !== "ALL") return twr(values, flows, window);
  const inception = values.find((value) => value.valueCad > 0);
  if (!inception) return null;
  return twr(
    values.filter((value) => value.date >= inception.date),
    flows.filter((flow) => flow.date >= inception.date),
    "ALL"
  );
}

function investorCashFlows(
  flows: ExternalFlow[],
  terminalValueCad: number,
  endDate: Date | string
): InvestorCashFlow[] {
  if (!Number.isFinite(terminalValueCad) || terminalValueCad < 0) {
    throw new Error("Terminal value must be a finite non-negative number");
  }

  const end = calendarDate(endDate);
  const amounts = new Map<string, number>();
  for (const [date, amount] of aggregateFlows(flows)) {
    if (date > end) {
      throw new Error(`External flow ${date} occurs after the MWR end date ${end}`);
    }
    amounts.set(date, (amounts.get(date) ?? 0) - amount);
  }
  amounts.set(end, (amounts.get(end) ?? 0) + terminalValueCad);

  return [...amounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, amount]) => ({ date, amount }));
}

function xnpv(cashFlows: InvestorCashFlow[], rate: number): number {
  if (!Number.isFinite(rate) || rate <= -1) return Number.NaN;
  const start = cashFlows[0]?.date;
  if (!start) return Number.NaN;

  return cashFlows.reduce((sum, flow) => {
    const years = calendarDaysBetween(start, flow.date) / 365;
    return sum + flow.amount / Math.pow(1 + rate, years);
  }, 0);
}

function sign(value: number, tolerance: number): -1 | 0 | 1 {
  if (Math.abs(value) <= tolerance) return 0;
  return value < 0 ? -1 : 1;
}

function xirr(cashFlows: InvestorCashFlow[]): number | null {
  if (cashFlows.length < 2) return null;
  if (!cashFlows.some((flow) => flow.amount < 0) || !cashFlows.some((flow) => flow.amount > 0)) {
    return null;
  }

  const cashScale = cashFlows.reduce((sum, flow) => sum + Math.abs(flow.amount), 0);
  const npvTolerance = Math.max(1e-8, cashScale * 1e-12);
  const yMin = Math.log1p(XIRR_MIN_RATE);
  const yMax = Math.log1p(XIRR_MAX_RATE);
  const rates = Array.from({ length: XIRR_SCAN_STEPS + 1 }, (_, index) =>
    Math.expm1(yMin + ((yMax - yMin) * index) / XIRR_SCAN_STEPS)
  );
  rates.push(0.1);
  rates.sort((left, right) => left - right);

  const brackets: Array<{ low: number; high: number; lowNpv: number; highNpv: number }> = [];
  const exactRoots: number[] = [];
  const samples = rates.map((rate) => ({ rate, npv: xnpv(cashFlows, rate) }));

  for (const sample of samples) {
    if (
      Number.isFinite(sample.npv) &&
      sign(sample.npv, npvTolerance) === 0 &&
      exactRoots.every((root) => Math.abs(root - sample.rate) > 1e-10)
    ) {
      exactRoots.push(sample.rate);
    }
  }

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    if (!Number.isFinite(previous.npv) || !Number.isFinite(current.npv)) continue;
    if (sign(previous.npv, npvTolerance) === 0 || sign(current.npv, npvTolerance) === 0) {
      continue;
    }
    if (sign(previous.npv, npvTolerance) !== sign(current.npv, npvTolerance)) {
      brackets.push({
        low: previous.rate,
        high: current.rate,
        lowNpv: previous.npv,
        highNpv: current.npv,
      });
    }
  }

  // Multiple valid IRRs are economically ambiguous; do not choose one arbitrarily.
  if (exactRoots.length + brackets.length !== 1) return null;
  if (exactRoots.length === 1) return exactRoots[0]!;

  let { low, high, lowNpv } = brackets[0]!;
  for (let iteration = 0; iteration < XIRR_MAX_ITERATIONS; iteration += 1) {
    const midpoint = (low + high) / 2;
    const midpointNpv = xnpv(cashFlows, midpoint);
    if (!Number.isFinite(midpointNpv)) return null;
    if (Math.abs(midpointNpv) <= npvTolerance || high - low <= 1e-12) {
      return midpoint;
    }

    if (sign(midpointNpv, npvTolerance) === sign(lowNpv, npvTolerance)) {
      low = midpoint;
      lowNpv = midpointNpv;
    } else {
      high = midpoint;
    }
  }

  const result = (low + high) / 2;
  return Math.abs(xnpv(cashFlows, result)) <= npvTolerance * 10 ? result : null;
}

export function mwr(
  flows: ExternalFlow[],
  terminalValueCad: number,
  endDate: Date | string
): number | null {
  return xirr(investorCashFlows(flows, terminalValueCad, endDate));
}

export function mwrNpv(
  flows: ExternalFlow[],
  terminalValueCad: number,
  endDate: Date | string,
  rate: number
): number {
  return xnpv(investorCashFlows(flows, terminalValueCad, endDate), rate);
}
