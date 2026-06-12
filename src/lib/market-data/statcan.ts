import { logger, safeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import type { MacroGroup, MacroIndicator } from "./macro";

// ─── Statistics Canada macro series, cached in MacroPoint ──────────────────
// The WDS REST API is keyless: one POST fetches every vector in one round
// trip. Monthly index-level series (CPI, GDP) are stored as derived YoY %
// under CA_* ids so the UI reads ready-to-plot points, exactly like the
// FRED pc1 series. 12-hour TTL matches macro.ts.

const STATCAN_TTL_MS = 12 * 60 * 60 * 1000;
const WDS_URL = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods";

type StatcanSeriesDef = {
  /** MacroPoint.seriesId — CA_ prefix keeps these clear of FRED ids. */
  id: string;
  vectorId: number;
  /** Periods to request — sized so YoY derivation + 3y sparklines survive. */
  latestN: number;
  label: string;
  decimals: number;
  group: MacroGroup;
  /** "yoy": store % change vs the observation 12 months earlier. */
  transform?: "yoy";
};

export const STATCAN_SERIES: StatcanSeriesDef[] = [
  {
    id: "CA_CPI_YOY",
    vectorId: 41690973, // CPI all-items, Canada, 2002=100, monthly
    latestN: 60,
    label: "Canada CPI YoY",
    decimals: 1,
    group: "inflation",
    transform: "yoy",
  },
  {
    id: "CA_UNEMP",
    vectorId: 2062815, // unemployment rate, 15+, seasonally adjusted, monthly
    latestN: 40,
    label: "Canada unemployment",
    decimals: 1,
    group: "labor",
  },
  {
    id: "CA_GDP_YOY",
    vectorId: 65201210, // real GDP at basic prices, all industries, monthly
    latestN: 60,
    label: "Canada GDP YoY",
    decimals: 1,
    group: "growth",
    transform: "yoy",
  },
  {
    id: "CA_OVERNIGHT",
    vectorId: 39079, // overnight money market financing rate, daily
    latestN: 450,
    label: "Canada overnight rate",
    decimals: 2,
    group: "policy",
  },
];

type Obs = { date: string; value: number };

type WdsResponse = {
  status: string;
  object?: {
    vectorId?: number;
    vectorDataPoint?: { refPer: string; value: number | null }[];
  };
}[];

async function fetchStatcanVectors(defs: StatcanSeriesDef[]): Promise<Map<string, Obs[]>> {
  const res = await fetch(WDS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(defs.map((d) => ({ vectorId: d.vectorId, latestN: d.latestN }))),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`StatCan WDS returned HTTP ${res.status}.`);
  const body = (await res.json()) as WdsResponse;

  const byVector = new Map<number, Obs[]>();
  for (const entry of body) {
    if (entry.status !== "SUCCESS" || !entry.object?.vectorId) continue;
    const points = (entry.object.vectorDataPoint ?? [])
      .filter((p) => p.value != null && Number.isFinite(p.value))
      .map((p) => ({ date: p.refPer, value: p.value as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
    byVector.set(entry.object.vectorId, points);
  }

  const out = new Map<string, Obs[]>();
  for (const def of defs) {
    let obs = byVector.get(def.vectorId) ?? [];
    if (def.transform === "yoy") obs = toYoY(obs);
    out.set(def.id, obs);
  }
  return out;
}

/** Monthly index level → % change vs the observation 12 months earlier. */
function toYoY(obs: Obs[]): Obs[] {
  const byDate = new Map(obs.map((o) => [o.date, o.value]));
  const out: Obs[] = [];
  for (const o of obs) {
    const yearAgoDate = String(Number(o.date.slice(0, 4)) - 1) + o.date.slice(4);
    const base = byDate.get(yearAgoDate);
    if (base != null && base !== 0) {
      out.push({ date: o.date, value: (o.value / base - 1) * 100 });
    }
  }
  return out;
}

/** Cached points per series (date asc), refreshing all stale series in one POST. */
async function ensureStatcanSeries(): Promise<Map<string, Obs[]>> {
  const rows = await prisma.macroPoint.findMany({
    where: { seriesId: { in: STATCAN_SERIES.map((d) => d.id) } },
    orderBy: { date: "asc" },
  });
  const cached = new Map<string, { obs: Obs[]; newestFetch: number }>();
  for (const def of STATCAN_SERIES) cached.set(def.id, { obs: [], newestFetch: 0 });
  for (const r of rows) {
    const c = cached.get(r.seriesId)!;
    c.obs.push({ date: r.date, value: r.value.toNumber() });
    c.newestFetch = Math.max(c.newestFetch, r.fetchedAt.getTime());
  }

  const stale = STATCAN_SERIES.filter((def) => {
    const c = cached.get(def.id)!;
    return c.obs.length === 0 || Date.now() - c.newestFetch > STATCAN_TTL_MS;
  });

  const out = new Map<string, Obs[]>();
  for (const def of STATCAN_SERIES) out.set(def.id, cached.get(def.id)!.obs);
  if (stale.length === 0) return out;

  try {
    const fresh = await fetchStatcanVectors(stale);
    for (const def of stale) {
      const obs = fresh.get(def.id) ?? [];
      if (obs.length === 0) continue;
      // Replace the window wholesale — StatCan revises recent observations.
      await prisma.$transaction([
        prisma.macroPoint.deleteMany({
          where: { seriesId: def.id, date: { gte: obs[0].date } },
        }),
        prisma.macroPoint.createMany({
          data: obs.map((o) => ({ seriesId: def.id, date: o.date, value: o.value })),
          skipDuplicates: true,
        }),
      ]);
      out.set(def.id, obs);
    }
  } catch (error) {
    logger.warn({ error: safeError(error) }, "statcan refresh failed");
  }
  return out;
}

function valueOnOrBefore(obs: Obs[], date: string): number | null {
  for (let i = obs.length - 1; i >= 0; i--) {
    if (obs[i].date <= date) return obs[i].value;
  }
  return null;
}

/** Canada macro indicators in the same shape the FRED overview produces. */
export async function getCanadaMacro(): Promise<MacroIndicator[]> {
  const series = await ensureStatcanSeries();
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return STATCAN_SERIES.map((def) => {
    const obs = series.get(def.id) ?? [];
    const latest = obs.at(-1) ?? null;
    const prev = obs.at(-2) ?? null;
    const yoyBase = latest ? valueOnOrBefore(obs, yearAgo) : null;
    return {
      id: def.id,
      label: def.label,
      unit: "%" as const,
      decimals: def.decimals,
      group: def.group,
      value: latest?.value ?? null,
      asOf: latest?.date ?? null,
      change: latest && prev ? latest.value - prev.value : null,
      changeYoY: latest && yoyBase != null ? latest.value - yoyBase : null,
      spark: obs.slice(-60),
    };
  });
}
