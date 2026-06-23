// Low-level Vala-Fi HTTP client. No caching or quota logic here — service.ts
// owns those so that cache hits never touch the network or the counters. Every
// function maps 1:1 to a documented endpoint and one billable request.

import { getValafiApiKey } from "@/lib/env";

import type {
  ValafiChangesFeed,
  ValafiCompany,
  ValafiDevUsage,
  ValafiExposure,
  ValafiImpact,
  ValafiPath,
  ValafiPortfolioAlerts,
  ValafiPortfolioCreated,
  ValafiPortfolioExposure,
  ValafiPortfolioSimulate,
  ValafiRelationships,
  ValafiSupplyChain,
  ValafiHolding,
} from "./types";

const BASE_URL = "https://api.valafi.dev";

/** status 0 means "not configured"; otherwise the upstream HTTP status. */
export class ValafiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ValafiError";
    this.status = status;
  }
}

export function valafiConfigured(): boolean {
  return getValafiApiKey() != null;
}

type Query = Record<string, string | number | undefined | null>;

async function vf<T>(
  path: string,
  opts: { query?: Query; method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const key = getValafiApiKey();
  if (!key) throw new ValafiError("VALAFI_API_KEY is not configured", 0);

  const url = new URL(BASE_URL + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      "X-API-Key": key,
      accept: "application/json",
      ...(opts.body != null ? { "content-type": "application/json" } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Vala-Fi returned HTTP ${res.status}`;
    try {
      const body = (await res.json()) as Record<string, unknown>;
      const detail = body.error ?? body.detail ?? body.message;
      if (detail) message = String(detail);
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new ValafiError(message, res.status);
  }

  return (await res.json()) as T;
}

// ── Company graph ───────────────────────────────────────────────────────────

export const getCompanyProfile = (ticker: string) =>
  vf<ValafiCompany>(`/v1/company/${encodeURIComponent(ticker)}`);

export const getSupplyChain = (
  ticker: string,
  direction: "upstream" | "downstream" | "both" = "both",
  hops = 2
) =>
  vf<ValafiSupplyChain>(`/v1/company/${encodeURIComponent(ticker)}/supply-chain`, {
    query: { direction, hops },
  });

export const getCustomers = (ticker: string) =>
  vf<ValafiRelationships>(`/v1/company/${encodeURIComponent(ticker)}/customers`);

export const getCompetitors = (ticker: string) =>
  vf<ValafiRelationships>(`/v1/company/${encodeURIComponent(ticker)}/competitors`);

export const getExposure = (ticker: string) =>
  vf<ValafiExposure>(`/v1/exposure/${encodeURIComponent(ticker)}`);

export const getImpact = (
  ticker: string,
  params: { disruption_type?: string; severity?: number; max_hops?: number } = {}
) =>
  vf<ValafiImpact>(`/v1/company/${encodeURIComponent(ticker)}/impact`, {
    query: {
      disruption_type: params.disruption_type,
      severity: params.severity,
      max_hops: params.max_hops,
    },
  });

export const getPath = (a: string, b: string) =>
  vf<ValafiPath>(`/v1/path/${encodeURIComponent(a)}/${encodeURIComponent(b)}`);

export const getChangesFeed = (params: { since: string; tickers?: string; limit?: number }) =>
  vf<ValafiChangesFeed>(`/v1/changes/feed`, {
    query: { since: params.since, tickers: params.tickers, limit: params.limit },
  });

// ── Portfolio monitoring ────────────────────────────────────────────────────

export const createPortfolio = (name: string, holdings: ValafiHolding[]) =>
  vf<ValafiPortfolioCreated>(`/v1/portfolio`, { method: "POST", body: { name, holdings } });

export const getPortfolioExposure = (id: number) =>
  vf<ValafiPortfolioExposure>(`/v1/portfolio/${id}/exposure`);

export const getPortfolioAlerts = (id: number) =>
  vf<ValafiPortfolioAlerts>(`/v1/portfolio/${id}/alerts`);

export const getPortfolioChanges = (id: number, since: string) =>
  vf<ValafiChangesFeed>(`/v1/portfolio/${id}/changes`, { query: { since } });

export const simulatePortfolio = (id: number, disruptedTicker: string) =>
  vf<ValafiPortfolioSimulate>(`/v1/portfolio/${id}/simulate`, {
    method: "POST",
    body: { disrupted_ticker: disruptedTicker },
  });

// ── Dev / quota ─────────────────────────────────────────────────────────────

export const getDevUsage = () => vf<ValafiDevUsage>(`/dev/usage`);
