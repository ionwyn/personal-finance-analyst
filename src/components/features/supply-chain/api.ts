// Browser-side fetchers for the Vala-Fi proxy routes. Only TYPES are imported
// from the lib layer (never the server modules), so no API key or DB code ever
// reaches the client. Every route returns the same envelope shape.

import type {
  ValafiChangesFeed,
  ValafiCompanyBundle,
  ValafiImpact,
  ValafiPath,
  ValafiPortfolioAlerts,
  ValafiPortfolioExposure,
  ValafiPortfolioSimulate,
  ValafiUsageSnapshot,
} from "@/lib/valafi/types";

export type Envelope<T> = {
  data: T | null;
  status: string; // ValafiStatus | "unregistered"
  needsConfirm?: boolean;
  usage: ValafiUsageSnapshot;
  fetchedAt?: string | null;
  message?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export const fetchUsage = (refresh = false) =>
  getJson<{ usage: ValafiUsageSnapshot }>(`/api/valafi/usage${refresh ? "?refresh=1" : ""}`);

export function fetchCompany(ticker: string, opts: { confirm?: boolean; peek?: boolean } = {}) {
  const q = new URLSearchParams();
  if (opts.confirm) q.set("confirm", "1");
  if (opts.peek) q.set("peek", "1");
  const s = q.toString();
  return getJson<Envelope<ValafiCompanyBundle>>(
    `/api/valafi/company/${encodeURIComponent(ticker)}${s ? `?${s}` : ""}`
  );
}

export function fetchImpact(
  ticker: string,
  opts: { severity?: number; maxHops?: number; disruptionType?: string; confirm?: boolean } = {}
) {
  const q = new URLSearchParams();
  if (opts.severity != null) q.set("severity", String(opts.severity));
  if (opts.maxHops != null) q.set("max_hops", String(opts.maxHops));
  if (opts.disruptionType) q.set("disruption_type", opts.disruptionType);
  if (opts.confirm) q.set("confirm", "1");
  const s = q.toString();
  return getJson<Envelope<ValafiImpact>>(
    `/api/valafi/company/${encodeURIComponent(ticker)}/impact${s ? `?${s}` : ""}`
  );
}

export function fetchPath(a: string, b: string, confirm = false) {
  return getJson<Envelope<ValafiPath>>(
    `/api/valafi/path/${encodeURIComponent(a)}/${encodeURIComponent(b)}${confirm ? "?confirm=1" : ""}`
  );
}

export const fetchPortfolioStatus = () =>
  getJson<{ registered: boolean; portfolioId: number | null; usage: ValafiUsageSnapshot }>(
    `/api/valafi/portfolio`
  );

export const enablePortfolio = () =>
  postJson<{
    result: { status: string; holdings: { ticker: string; weight: number }[] };
    measured: { tickerDelta: number; requestDelta: number };
    usage: ValafiUsageSnapshot;
  }>(`/api/valafi/portfolio`);

export const fetchExposure = () =>
  getJson<Envelope<ValafiPortfolioExposure>>(`/api/valafi/portfolio/exposure`);

export const fetchAlerts = () =>
  getJson<Envelope<ValafiPortfolioAlerts>>(`/api/valafi/portfolio/alerts`);

export const fetchChanges = (since?: string) =>
  getJson<Envelope<ValafiChangesFeed>>(
    `/api/valafi/portfolio/changes${since ? `?since=${since}` : ""}`
  );

export const simulate = (ticker: string) =>
  postJson<Envelope<ValafiPortfolioSimulate>>(`/api/valafi/portfolio/simulate`, { ticker });
