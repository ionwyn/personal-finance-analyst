import { getFredApiKey } from "@/lib/env";
import { logger, safeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

// ─── FRED-backed macro series, cached in MacroPoint ────────────────────────
// FRED's free tier allows 120 req/min; with a 12-hour TTL and ~20 series the
// app stays orders of magnitude under the limit.

const MACRO_TTL_MS = 12 * 60 * 60 * 1000;

export type MacroGroup = "policy" | "yields" | "inflation" | "labor" | "growth" | "fx";

export type MacroSeriesDef = {
  /** Our cache key (MacroPoint.seriesId). Differs from fredId when a units
   *  transform is applied (e.g. CPI level → YoY %). */
  id: string;
  fredId: string;
  label: string;
  unit: "%" | "fx";
  decimals: number;
  /** FRED `units` param — "pc1" = percent change from year ago. */
  fredUnits?: "pc1";
  /** Calendar days of history to fetch & keep refreshed. */
  historyDays: number;
  group: MacroGroup;
};

const D = 420; // daily series: ~13 months (covers year-ago curve + sparklines)
const M = 1150; // monthly series: ~3 years of points

export const MACRO_SERIES: MacroSeriesDef[] = [
  {
    id: "FEDFUNDS_U",
    fredId: "DFEDTARU",
    label: "Fed funds (upper)",
    unit: "%",
    decimals: 2,
    historyDays: D,
    group: "policy",
  },
  {
    id: "UST3M",
    fredId: "DGS3MO",
    label: "US 3M",
    unit: "%",
    decimals: 2,
    historyDays: D,
    group: "yields",
  },
  {
    id: "UST2Y",
    fredId: "DGS2",
    label: "US 2Y",
    unit: "%",
    decimals: 2,
    historyDays: D,
    group: "yields",
  },
  {
    id: "UST10Y",
    fredId: "DGS10",
    label: "US 10Y",
    unit: "%",
    decimals: 2,
    historyDays: D,
    group: "yields",
  },
  {
    id: "UST30Y",
    fredId: "DGS30",
    label: "US 30Y",
    unit: "%",
    decimals: 2,
    historyDays: D,
    group: "yields",
  },
  {
    id: "T10Y2Y",
    fredId: "T10Y2Y",
    label: "2s10s spread",
    unit: "%",
    decimals: 2,
    historyDays: D,
    group: "yields",
  },
  {
    id: "CPI_YOY",
    fredId: "CPIAUCSL",
    label: "US CPI YoY",
    unit: "%",
    decimals: 1,
    fredUnits: "pc1",
    historyDays: M,
    group: "inflation",
  },
  {
    id: "UNRATE",
    fredId: "UNRATE",
    label: "US unemployment",
    unit: "%",
    decimals: 1,
    historyDays: M,
    group: "labor",
  },
  {
    id: "CA10Y",
    fredId: "IRLTLT01CAM156N",
    label: "Canada 10Y",
    unit: "%",
    decimals: 2,
    historyDays: M,
    group: "yields",
  },
  {
    id: "USDCAD",
    fredId: "DEXCAUS",
    label: "USD/CAD",
    unit: "fx",
    decimals: 4,
    historyDays: D,
    group: "fx",
  },
];

// Tenors for the treasury yield-curve chart (all daily FRED series).
export const YIELD_TENORS: { tenor: string; years: number; fredId: string }[] = [
  { tenor: "1M", years: 1 / 12, fredId: "DGS1MO" },
  { tenor: "3M", years: 0.25, fredId: "DGS3MO" },
  { tenor: "6M", years: 0.5, fredId: "DGS6MO" },
  { tenor: "1Y", years: 1, fredId: "DGS1" },
  { tenor: "2Y", years: 2, fredId: "DGS2" },
  { tenor: "3Y", years: 3, fredId: "DGS3" },
  { tenor: "5Y", years: 5, fredId: "DGS5" },
  { tenor: "7Y", years: 7, fredId: "DGS7" },
  { tenor: "10Y", years: 10, fredId: "DGS10" },
  { tenor: "20Y", years: 20, fredId: "DGS20" },
  { tenor: "30Y", years: 30, fredId: "DGS30" },
];

// Curve tenors not already in MACRO_SERIES get a minimal def (id = fredId).
const CURVE_ONLY_DEFS: MacroSeriesDef[] = YIELD_TENORS.filter(
  (t) => !MACRO_SERIES.some((s) => s.fredId === t.fredId)
).map((t) => ({
  id: t.fredId,
  fredId: t.fredId,
  label: t.tenor,
  unit: "%" as const,
  decimals: 2,
  historyDays: D,
  group: "yields" as const,
}));

const ALL_DEFS = [...MACRO_SERIES, ...CURVE_ONLY_DEFS];

// ─── FRED fetch + cache ─────────────────────────────────────────────────────

type Obs = { date: string; value: number };

async function fetchFredObservations(def: MacroSeriesDef): Promise<Obs[]> {
  const start = new Date(Date.now() - def.historyDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", def.fredId);
  url.searchParams.set("api_key", getFredApiKey());
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", start);
  if (def.fredUnits) url.searchParams.set("units", def.fredUnits);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`FRED returned HTTP ${res.status} for ${def.fredId}.`);
  const body = (await res.json()) as { observations?: { date: string; value: string }[] };
  return (body.observations ?? [])
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((o) => Number.isFinite(o.value));
}

/** Cached points for one series (date asc), refreshing from FRED when stale. */
async function ensureSeries(def: MacroSeriesDef): Promise<Obs[]> {
  const rows = await prisma.macroPoint.findMany({
    where: { seriesId: def.id },
    orderBy: { date: "asc" },
  });
  const newest = rows.at(-1);
  const fresh = newest && Date.now() - newest.fetchedAt.getTime() < MACRO_TTL_MS;
  if (fresh) return rows.map((r) => ({ date: r.date, value: r.value.toNumber() }));

  try {
    const obs = await fetchFredObservations(def);
    if (obs.length > 0) {
      const windowStart = obs[0].date;
      // Replace the fetch window wholesale — FRED revises recent observations.
      await prisma.$transaction([
        prisma.macroPoint.deleteMany({ where: { seriesId: def.id, date: { gte: windowStart } } }),
        prisma.macroPoint.createMany({
          data: obs.map((o) => ({ seriesId: def.id, date: o.date, value: o.value })),
          skipDuplicates: true,
        }),
      ]);
      return obs;
    }
  } catch (error) {
    logger.warn({ seriesId: def.id, error: safeError(error) }, "macro series refresh failed");
  }
  // Fall back to whatever is cached (possibly empty).
  return rows.map((r) => ({ date: r.date, value: r.value.toNumber() }));
}

// ─── Public: macro indicator strip ──────────────────────────────────────────

export type MacroIndicator = {
  id: string;
  label: string;
  unit: "%" | "fx";
  decimals: number;
  group: MacroGroup;
  value: number | null;
  asOf: string | null; // YYYY-MM-DD
  /** Change vs previous observation, in the series' own units. */
  change: number | null;
  /** Change vs ~1 year ago, in the series' own units. */
  changeYoY: number | null;
  /** Recent history for sparklines (oldest → newest, up to 60 points). */
  spark: { date: string; value: number }[];
};

function valueOnOrBefore(obs: Obs[], date: string): number | null {
  for (let i = obs.length - 1; i >= 0; i--) {
    if (obs[i].date <= date) return obs[i].value;
  }
  return null;
}

export async function getMacroOverview(): Promise<MacroIndicator[]> {
  const series = await Promise.all(MACRO_SERIES.map((def) => ensureSeries(def)));
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return MACRO_SERIES.map((def, i) => {
    const obs = series[i];
    const latest = obs.at(-1) ?? null;
    const prev = obs.at(-2) ?? null;
    const yoyBase = latest ? valueOnOrBefore(obs, yearAgo) : null;
    const sparkSource = obs.slice(-60);
    return {
      id: def.id,
      label: def.label,
      unit: def.unit,
      decimals: def.decimals,
      group: def.group,
      value: latest?.value ?? null,
      asOf: latest?.date ?? null,
      change: latest && prev ? latest.value - prev.value : null,
      changeYoY: latest && yoyBase != null ? latest.value - yoyBase : null,
      spark: sparkSource,
    };
  });
}

// ─── Public: treasury yield curve (today vs 1M vs 1Y ago) ──────────────────

export type YieldCurvePoint = {
  tenor: string;
  years: number;
  today: number | null;
  monthAgo: number | null;
  yearAgo: number | null;
};

export type YieldCurveData = {
  points: YieldCurvePoint[];
  asOf: string | null;
};

export async function getYieldCurve(): Promise<YieldCurveData> {
  const defs = YIELD_TENORS.map(
    (t) => ALL_DEFS.find((d) => d.fredId === t.fredId && !d.fredUnits)!
  );
  const series = await Promise.all(defs.map((def) => ensureSeries(def)));

  const monthAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yearAgoDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let asOf: string | null = null;
  const points = YIELD_TENORS.map((t, i) => {
    const obs = series[i];
    const latest = obs.at(-1) ?? null;
    if (latest && (asOf == null || latest.date > asOf)) asOf = latest.date;
    return {
      tenor: t.tenor,
      years: t.years,
      today: latest?.value ?? null,
      monthAgo: valueOnOrBefore(obs, monthAgoDate),
      yearAgo: valueOnOrBefore(obs, yearAgoDate),
    };
  });

  return { points, asOf };
}
