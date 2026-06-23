// Postgres cache for Vala-Fi responses. Relationships come from quarterly SEC
// filings, so TTLs are long — once a company is fetched, re-browsing it costs
// nothing for days. Negative caching (status EMPTY/ERROR) stops foreign
// listings and transient failures from re-spending the tight quota.

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const TTL_MS: Record<string, number> = {
  company: 30 * DAY,
  "supply-chain": 7 * DAY,
  competitors: 7 * DAY,
  exposure: 7 * DAY,
  impact: 7 * DAY,
  path: 14 * DAY,
  "pf-exposure": DAY,
  "pf-alerts": DAY,
  "pf-changes": 12 * HOUR,
  "pf-sim": DAY,
  feed: 12 * HOUR,
};

const EMPTY_TTL_MS = 30 * DAY; // "not in the graph" rarely changes
const ERROR_TTL_MS = 6 * HOUR; // give transient failures a chance to recover

export type CacheStatus = "OK" | "EMPTY" | "ERROR";

export type CacheHit<T> = {
  data: T;
  status: CacheStatus;
  fetchedAt: Date;
};

export async function readCache<T>(key: string): Promise<CacheHit<T> | null> {
  const row = await prisma.valafiCache.findUnique({ where: { key } });
  if (!row) return null;
  return {
    data: row.data as unknown as T,
    status: row.status as CacheStatus,
    fetchedAt: row.fetchedAt,
  };
}

export function cacheFresh(row: { status: string; fetchedAt: Date }, kind: string): boolean {
  const age = Date.now() - row.fetchedAt.getTime();
  if (row.status === "EMPTY") return age < EMPTY_TTL_MS;
  if (row.status === "ERROR") return age < ERROR_TTL_MS;
  return age < (TTL_MS[kind] ?? DAY);
}

export async function writeCache(
  key: string,
  kind: string,
  ticker: string | null,
  status: CacheStatus,
  data: unknown
): Promise<void> {
  const json = (data ?? {}) as Prisma.InputJsonValue;
  await prisma.valafiCache.upsert({
    where: { key },
    create: { key, kind, ticker, status, data: json },
    update: { kind, ticker, status, data: json, fetchedAt: new Date() },
  });
}
