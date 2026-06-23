// Free-tier quota governor. The Vala-Fi free tier allows 50 requests/day and
// only 10 unique tickers/day, so every live call is metered here. A ticker is
// "spent" only the first time we make a company-scoped live call for it on a
// given day (ValafiTickerDay); cache hits never touch these counters. The meter
// reconciles our local counts against Vala-Fi's own /dev/usage once a day so it
// stays accurate even if the key is used elsewhere.

import { logger, safeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { getDevUsage, valafiConfigured } from "./client";
import type { ValafiUsageSnapshot } from "./types";

export const VALAFI_LIMITS = {
  DAILY_REQUEST_CAP: 50,
  /** Stop auto-spending once we've used this many — keeps headroom for retries. */
  REQUEST_SOFT_STOP: 46,
  DAILY_TICKER_CAP: 10,
  /** Beyond this many companies today, spending a new one needs confirmation. */
  TICKER_CONFIRM_THRESHOLD: 8,
} as const;

/** UTC date key — aligns with the provider's midnight-UTC quota reset. */
export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function disabledSnapshot(date: string): ValafiUsageSnapshot {
  return {
    date,
    requests: 0,
    requestCap: VALAFI_LIMITS.DAILY_REQUEST_CAP,
    uniqueTickers: 0,
    tickerCap: VALAFI_LIMITS.DAILY_TICKER_CAP,
    confirmThreshold: VALAFI_LIMITS.TICKER_CONFIRM_THRESHOLD,
    remoteSyncedAt: null,
    source: "disabled",
  };
}

/** DB-only snapshot (no network). Effective counts = max(local, last remote). */
export async function getEffectiveUsage(): Promise<ValafiUsageSnapshot> {
  const date = todayKey();
  if (!valafiConfigured()) return disabledSnapshot(date);

  const [row, tickerCount] = await Promise.all([
    prisma.valafiUsageDay.findUnique({ where: { date } }),
    prisma.valafiTickerDay.count({ where: { date } }),
  ]);

  const hasRemote = row?.remoteRequests != null;
  const requests = Math.max(row?.requests ?? 0, hasRemote ? (row?.remoteRequests ?? 0) : 0);
  const uniqueTickers = Math.max(tickerCount, hasRemote ? (row?.remoteTickers ?? 0) : 0);

  return {
    date,
    requests,
    requestCap: VALAFI_LIMITS.DAILY_REQUEST_CAP,
    uniqueTickers,
    tickerCap: VALAFI_LIMITS.DAILY_TICKER_CAP,
    confirmThreshold: VALAFI_LIMITS.TICKER_CONFIRM_THRESHOLD,
    remoteSyncedAt: hasRemote && row ? row.syncedAt.toISOString() : null,
    source: hasRemote ? "reconciled" : "local",
  };
}

/** Public meter. Syncs /dev/usage once per day (or on `forceRemote`). */
export async function getUsage(opts: { forceRemote?: boolean } = {}): Promise<ValafiUsageSnapshot> {
  if (!valafiConfigured()) return disabledSnapshot(todayKey());

  const date = todayKey();
  const row = await prisma.valafiUsageDay.findUnique({ where: { date } });
  const needsRemote = opts.forceRemote || !row || row.remoteRequests == null;

  if (needsRemote) {
    try {
      const usage = await getDevUsage();
      await prisma.valafiUsageDay.upsert({
        where: { date },
        create: {
          date,
          requests: 0,
          remoteRequests: usage.requests_today,
          remoteTickers: usage.unique_tickers_today,
          syncedAt: new Date(),
        },
        update: {
          remoteRequests: usage.requests_today,
          remoteTickers: usage.unique_tickers_today,
          syncedAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn({ error: safeError(error) }, "valafi /dev/usage sync failed");
    }
  }

  return getEffectiveUsage();
}

// ── Counters ────────────────────────────────────────────────────────────────

export async function noteRequest(n = 1): Promise<void> {
  const date = todayKey();
  await prisma.valafiUsageDay.upsert({
    where: { date },
    create: { date, requests: n },
    update: { requests: { increment: n } },
  });
}

export async function noteTickers(tickers: string[]): Promise<void> {
  const date = todayKey();
  const uniq = [...new Set(tickers.map((t) => t.toUpperCase()))].filter(Boolean);
  if (uniq.length === 0) return;
  await prisma.valafiTickerDay.createMany({
    data: uniq.map((ticker) => ({ date, ticker })),
    skipDuplicates: true,
  });
}

export async function isTickerSpentToday(ticker: string): Promise<boolean> {
  const row = await prisma.valafiTickerDay.findUnique({
    where: { date_ticker: { date: todayKey(), ticker: ticker.toUpperCase() } },
  });
  return row != null;
}

// ── Gates ─────────────────────────────────────────────────────────────────

export type GateDecision =
  | { ok: true; usage: ValafiUsageSnapshot }
  | { ok: false; reason: "needsConfirm" | "exhausted"; usage: ValafiUsageSnapshot };

async function gateSpend(
  newTickers: string[],
  requestCost: number,
  confirm: boolean
): Promise<GateDecision> {
  const usage = await getEffectiveUsage();
  if (usage.source === "disabled") return { ok: false, reason: "exhausted", usage };

  if (usage.requests >= VALAFI_LIMITS.REQUEST_SOFT_STOP) {
    return { ok: false, reason: "exhausted", usage };
  }
  if (usage.requests + requestCost > usage.requestCap) {
    return { ok: false, reason: "exhausted", usage };
  }

  const distinctNew = [...new Set(newTickers.map((t) => t.toUpperCase()))].filter(Boolean);
  if (distinctNew.length > 0) {
    if (usage.uniqueTickers + distinctNew.length > usage.tickerCap) {
      return { ok: false, reason: "exhausted", usage };
    }
    if (usage.uniqueTickers >= usage.confirmThreshold && !confirm) {
      return { ok: false, reason: "needsConfirm", usage };
    }
  }
  return { ok: true, usage };
}

/** Gate a call scoped to one company; spends a ticker only if not already spent today. */
export async function gateCompanyCall(
  ticker: string,
  opts: { confirm?: boolean; requestCost?: number } = {}
): Promise<GateDecision> {
  const t = ticker.toUpperCase();
  const spent = await isTickerSpentToday(t);
  return gateSpend(spent ? [] : [t], opts.requestCost ?? 1, opts.confirm ?? false);
}

/** Gate a path lookup; may spend up to two new tickers. */
export async function gatePathCall(
  a: string,
  b: string,
  opts: { confirm?: boolean } = {}
): Promise<GateDecision> {
  const ta = a.toUpperCase();
  const tb = b.toUpperCase();
  const [sa, sb] = await Promise.all([isTickerSpentToday(ta), isTickerSpentToday(tb)]);
  const fresh: string[] = [];
  if (!sa) fresh.push(ta);
  if (!sb && tb !== ta) fresh.push(tb);
  return gateSpend(fresh, 1, opts.confirm ?? false);
}

/** Gate a call that spends request budget but no ticker (feed, portfolio). */
export async function gateGlobalCall(
  opts: { confirm?: boolean; requestCost?: number } = {}
): Promise<GateDecision> {
  return gateSpend([], opts.requestCost ?? 1, opts.confirm ?? false);
}
