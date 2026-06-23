// High-level Vala-Fi access. Every function follows the same shape: read cache
// → if fresh, return with no spend → otherwise ask the governor → if allowed,
// fetch + cache + meter → if blocked, return whatever is cached (or empty) with
// a status the UI can act on. This is the only module routes should call.

import { logger, safeError } from "@/lib/logger";

import * as api from "./client";
import { ValafiError } from "./client";
import { cacheFresh, readCache, writeCache, type CacheStatus } from "./cache";
import {
  gateCompanyCall,
  gateGlobalCall,
  gatePathCall,
  getEffectiveUsage,
  noteRequest,
  noteTickers,
} from "./governor";
import { isLikelyUsListed, normalizeTicker } from "./symbols";
import type {
  ValafiChangesFeed,
  ValafiCompany,
  ValafiCompanyBundle,
  ValafiExposure,
  ValafiImpact,
  ValafiPath,
  ValafiPortfolioAlerts,
  ValafiPortfolioExposure,
  ValafiPortfolioSimulate,
  ValafiRelationships,
  ValafiResult,
  ValafiSupplyChain,
} from "./types";

type Attempt<T> = { status: CacheStatus; data: T | null };

/** Run a client call, classifying failures for the negative cache. */
async function attempt<T>(fn: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { status: "OK", data: await fn() };
  } catch (error) {
    if (error instanceof ValafiError && error.status === 404) {
      return { status: "EMPTY", data: null };
    }
    logger.warn({ error: safeError(error) }, "valafi request failed");
    return { status: "ERROR", data: null };
  }
}

const EMPTY_BUNDLE = (ticker: string): ValafiCompanyBundle => ({
  ticker,
  profile: null,
  suppliers: [],
  customers: [],
  competitors: [],
  exposure: null,
  truncated: false,
  maxHopsAvailable: null,
});

function rowData<T>(row: { status: CacheStatus; data: unknown } | null): T | null {
  return row && row.status === "OK" ? (row.data as T) : null;
}

function buildBundle(
  ticker: string,
  profile: ValafiCompany | null,
  scUp: ValafiSupplyChain | null, // upstream: edges source=ticker → targets are suppliers
  scDown: ValafiSupplyChain | null, // downstream: edges target=ticker → sources are customers
  comp: ValafiRelationships | null,
  exp: ValafiExposure | null
): ValafiCompanyBundle {
  // Vala-Fi returns edges under the "suppliers" key for every direction; the
  // direction parameter is what controls which side we get. A single
  // direction=both call only returns the top 5 by strength (often all upstream),
  // so we query each side separately to populate both columns. counterpart()
  // resolves the non-centre endpoint correctly for either edge orientation.
  return {
    ticker,
    profile: profile ?? scUp?.company ?? scDown?.company ?? exp?.company ?? null,
    suppliers: scUp?.suppliers ?? [],
    customers: scDown?.suppliers ?? [],
    competitors: comp?.relationships ?? [],
    exposure: exp ?? null,
    truncated: Boolean(scUp?.truncated || scDown?.truncated),
    maxHopsAvailable: scUp?.max_hops_available ?? scDown?.max_hops_available ?? null,
  };
}

// ── Company bundle (profile + suppliers + customers + competitors + exposure) ─
// 5 requests, 1 unique ticker. `peek` reads cache only and never spends.

export async function getCompanyBundle(
  ticker: string,
  opts: { confirm?: boolean; peek?: boolean } = {}
): Promise<ValafiResult<ValafiCompanyBundle>> {
  const t = normalizeTicker(ticker);

  if (!isLikelyUsListed(t)) {
    return {
      data: EMPTY_BUNDLE(t),
      status: "empty",
      usage: await getEffectiveUsage(),
      message: "Not a US-listed issuer tracked by Vala-Fi.",
    };
  }

  const keys = {
    profile: `company:${t}`,
    scUp: `sc:${t}:up:1`,
    scDown: `sc:${t}:down:1`,
    comp: `competitors:${t}`,
    exp: `exposure:${t}`,
  };

  const [pRow, upRow, downRow, cRow, eRow] = await Promise.all([
    readCache<ValafiCompany>(keys.profile),
    readCache<ValafiSupplyChain>(keys.scUp),
    readCache<ValafiSupplyChain>(keys.scDown),
    readCache<ValafiRelationships>(keys.comp),
    readCache<ValafiExposure>(keys.exp),
  ]);

  const allFresh =
    pRow &&
    cacheFresh(pRow, "company") &&
    upRow &&
    cacheFresh(upRow, "supply-chain") &&
    downRow &&
    cacheFresh(downRow, "supply-chain") &&
    cRow &&
    cacheFresh(cRow, "competitors") &&
    eRow &&
    cacheFresh(eRow, "exposure");

  const cachedBundle = () =>
    buildBundle(
      t,
      rowData<ValafiCompany>(pRow),
      rowData<ValafiSupplyChain>(upRow),
      rowData<ValafiSupplyChain>(downRow),
      rowData<ValafiRelationships>(cRow),
      rowData<ValafiExposure>(eRow)
    );

  const anyCached = Boolean(pRow || upRow || downRow || cRow || eRow);
  const anyEmpty = [pRow, upRow, downRow, cRow, eRow].some((r) => r?.status === "EMPTY");

  if (allFresh) {
    return {
      data: cachedBundle(),
      status: anyEmpty && !pRow?.data ? "empty" : "cached",
      usage: await getEffectiveUsage(),
      fetchedAt: upRow?.fetchedAt.toISOString() ?? null,
    };
  }

  // A live refresh is needed.
  if (opts.peek || !api.valafiConfigured()) {
    return {
      data: anyCached ? cachedBundle() : EMPTY_BUNDLE(t),
      status: !api.valafiConfigured() ? "disabled" : anyCached ? "stale" : "blocked",
      usage: await getEffectiveUsage(),
      fetchedAt: upRow?.fetchedAt.toISOString() ?? null,
    };
  }

  const gate = await gateCompanyCall(t, { confirm: opts.confirm, requestCost: 5 });
  if (!gate.ok) {
    return {
      data: anyCached ? cachedBundle() : EMPTY_BUNDLE(t),
      status: "blocked",
      needsConfirm: gate.reason === "needsConfirm",
      usage: gate.usage,
      fetchedAt: upRow?.fetchedAt.toISOString() ?? null,
    };
  }

  // Spend: one ticker, five parallel requests (profile + suppliers + customers
  // + competitors + exposure). Suppliers and customers are separate directional
  // queries because direction=both only yields the top 5 by strength.
  await noteTickers([t]);
  const [profile, scUp, scDown, comp, exp] = await Promise.all([
    attempt(() => api.getCompanyProfile(t)),
    attempt(() => api.getSupplyChain(t, "upstream", 1)),
    attempt(() => api.getSupplyChain(t, "downstream", 1)),
    attempt(() => api.getCompetitors(t)),
    attempt(() => api.getExposure(t)),
  ]);
  await noteRequest(5);

  await Promise.all([
    writeCache(keys.profile, "company", t, profile.status, profile.data),
    writeCache(keys.scUp, "supply-chain", t, scUp.status, scUp.data),
    writeCache(keys.scDown, "supply-chain", t, scDown.status, scDown.data),
    writeCache(keys.comp, "competitors", t, comp.status, comp.data),
    writeCache(keys.exp, "exposure", t, exp.status, exp.data),
  ]);

  const bundle = buildBundle(t, profile.data, scUp.data, scDown.data, comp.data, exp.data);
  const isEmpty = !profile.data && !scUp.data && !scDown.data && !comp.data && !exp.data;
  return {
    data: bundle,
    status: isEmpty ? "empty" : "fresh",
    usage: await getEffectiveUsage(),
    fetchedAt: new Date().toISOString(),
    message: isEmpty ? "No supply-chain data found for this company." : undefined,
  };
}

// ── Impact simulation (disruption cascade) ───────────────────────────────────

export async function getImpact(
  ticker: string,
  params: { disruptionType?: string; severity?: number; maxHops?: number; confirm?: boolean } = {}
): Promise<ValafiResult<ValafiImpact>> {
  const t = normalizeTicker(ticker);
  const disruptionType = params.disruptionType ?? "supply_halt";
  const severity = clamp(params.severity ?? 1, 0, 1);
  const maxHops = clampInt(params.maxHops ?? 3, 1, 5);

  if (!isLikelyUsListed(t)) {
    return { data: null, status: "empty", usage: await getEffectiveUsage() };
  }

  const key = `impact:${t}:${disruptionType}:${Math.round(severity * 100)}:${maxHops}`;
  const row = await readCache<ValafiImpact>(key);
  if (row && cacheFresh(row, "impact")) {
    return {
      data: rowData<ValafiImpact>(row),
      status: row.status === "OK" ? "cached" : "empty",
      usage: await getEffectiveUsage(),
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }

  if (!api.valafiConfigured()) {
    return {
      data: rowData<ValafiImpact>(row),
      status: "disabled",
      usage: await getEffectiveUsage(),
    };
  }

  const gate = await gateCompanyCall(t, { confirm: params.confirm, requestCost: 1 });
  if (!gate.ok) {
    return {
      data: rowData<ValafiImpact>(row),
      status: "blocked",
      needsConfirm: gate.reason === "needsConfirm",
      usage: gate.usage,
    };
  }

  await noteTickers([t]);
  const res = await attempt(() =>
    api.getImpact(t, { disruption_type: disruptionType, severity, max_hops: maxHops })
  );
  await noteRequest(1);
  await writeCache(key, "impact", t, res.status, res.data);

  return {
    data: res.data,
    status: res.data ? "fresh" : res.status === "EMPTY" ? "empty" : "error",
    usage: await getEffectiveUsage(),
    fetchedAt: new Date().toISOString(),
  };
}

// ── Shortest path between two companies ──────────────────────────────────────

export async function getPath(
  a: string,
  b: string,
  opts: { confirm?: boolean } = {}
): Promise<ValafiResult<ValafiPath>> {
  const ta = normalizeTicker(a);
  const tb = normalizeTicker(b);

  if (!isLikelyUsListed(ta) || !isLikelyUsListed(tb)) {
    return {
      data: null,
      status: "empty",
      usage: await getEffectiveUsage(),
      message: "Both companies must be US-listed issuers.",
    };
  }

  const key = `path:${ta}:${tb}`;
  const row = await readCache<ValafiPath>(key);
  if (row && cacheFresh(row, "path")) {
    return {
      data: rowData<ValafiPath>(row),
      status: row.status === "OK" ? "cached" : "empty",
      usage: await getEffectiveUsage(),
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }

  if (!api.valafiConfigured()) {
    return { data: rowData<ValafiPath>(row), status: "disabled", usage: await getEffectiveUsage() };
  }

  const gate = await gatePathCall(ta, tb, { confirm: opts.confirm });
  if (!gate.ok) {
    return {
      data: rowData<ValafiPath>(row),
      status: "blocked",
      needsConfirm: gate.reason === "needsConfirm",
      usage: gate.usage,
    };
  }

  await noteTickers([ta, tb]);
  const res = await attempt(() => api.getPath(ta, tb));
  await noteRequest(1);
  await writeCache(key, "path", ta, res.status, res.data);

  return {
    data: res.data,
    status: res.data ? "fresh" : res.status === "EMPTY" ? "empty" : "error",
    usage: await getEffectiveUsage(),
    fetchedAt: new Date().toISOString(),
  };
}

// ── Cross-company change feed ────────────────────────────────────────────────

export async function getChangesFeed(params: {
  since: string;
  tickers?: string[];
}): Promise<ValafiResult<ValafiChangesFeed>> {
  const tickers = params.tickers?.map(normalizeTicker).filter(isLikelyUsListed) ?? [];
  const tickerParam = tickers.length ? tickers.join(",") : undefined;
  const key = `feed:${params.since}:${tickerParam ?? "all"}`;

  const row = await readCache<ValafiChangesFeed>(key);
  if (row && cacheFresh(row, "feed")) {
    return {
      data: rowData<ValafiChangesFeed>(row),
      status: "cached",
      usage: await getEffectiveUsage(),
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }

  if (!api.valafiConfigured()) {
    return {
      data: rowData<ValafiChangesFeed>(row),
      status: "disabled",
      usage: await getEffectiveUsage(),
    };
  }

  const gate = await gateGlobalCall({ requestCost: 1 });
  if (!gate.ok) {
    return { data: rowData<ValafiChangesFeed>(row), status: "blocked", usage: gate.usage };
  }

  const res = await attempt(() =>
    api.getChangesFeed({ since: params.since, tickers: tickerParam, limit: 200 })
  );
  await noteRequest(1);
  await writeCache(key, "feed", null, res.status, res.data);

  return {
    data: res.data,
    status: res.data ? "fresh" : "error",
    usage: await getEffectiveUsage(),
    fetchedAt: new Date().toISOString(),
  };
}

// ── Portfolio-scoped reads (no ticker spend; require a registered portfolio) ─

export async function getPortfolioExposure(
  portfolioId: number
): Promise<ValafiResult<ValafiPortfolioExposure>> {
  return cachedPortfolioCall(`pf-exposure:${portfolioId}`, "pf-exposure", () =>
    api.getPortfolioExposure(portfolioId)
  );
}

export async function getPortfolioAlerts(
  portfolioId: number
): Promise<ValafiResult<ValafiPortfolioAlerts>> {
  return cachedPortfolioCall(`pf-alerts:${portfolioId}`, "pf-alerts", () =>
    api.getPortfolioAlerts(portfolioId)
  );
}

export async function getPortfolioChanges(
  portfolioId: number,
  since: string
): Promise<ValafiResult<ValafiChangesFeed>> {
  return cachedPortfolioCall(`pf-changes:${portfolioId}:${since}`, "pf-changes", () =>
    api.getPortfolioChanges(portfolioId, since)
  );
}

export async function simulatePortfolio(
  portfolioId: number,
  disruptedTicker: string
): Promise<ValafiResult<ValafiPortfolioSimulate>> {
  const t = normalizeTicker(disruptedTicker);
  return cachedPortfolioCall(`pf-sim:${portfolioId}:${t}`, "pf-sim", () =>
    api.simulatePortfolio(portfolioId, t)
  );
}

async function cachedPortfolioCall<T>(
  key: string,
  kind: string,
  fn: () => Promise<T>
): Promise<ValafiResult<T>> {
  const row = await readCache<T>(key);
  if (row && cacheFresh(row, kind)) {
    return {
      data: rowData<T>(row),
      status: "cached",
      usage: await getEffectiveUsage(),
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }
  if (!api.valafiConfigured()) {
    return { data: rowData<T>(row), status: "disabled", usage: await getEffectiveUsage() };
  }

  const gate = await gateGlobalCall({ requestCost: 1 });
  if (!gate.ok) {
    return { data: rowData<T>(row), status: "blocked", usage: gate.usage };
  }

  const res = await attempt(fn);
  await noteRequest(1);
  await writeCache(key, kind, null, res.status, res.data);

  return {
    data: res.data,
    status: res.data ? "fresh" : res.status === "EMPTY" ? "empty" : "error",
    usage: await getEffectiveUsage(),
    fetchedAt: new Date().toISOString(),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function clampInt(v: number, lo: number, hi: number): number {
  return clamp(Math.round(v), lo, hi);
}
