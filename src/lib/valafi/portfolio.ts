// Registers the tenant's holdings as a Vala-Fi portfolio so the cheap
// portfolio-level endpoints (exposure / alerts / changes / simulate) can run
// against one portfolio_id. Re-registers only when the holdings hash changes.
//
// QUOTA CAVEAT: it's not documented whether POST /v1/portfolio consumes the
// unique-ticker budget (one per holding) or just one request. We treat it as a
// single request here and surface the measured /dev/usage delta in the enable
// flow (see the portfolio enable route). Registration is user-initiated, never
// automatic, so the budget is never spent behind the user's back.

import crypto from "node:crypto";

import { logger, safeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import * as api from "./client";
import { gateGlobalCall, noteRequest } from "./governor";
import { isTrackable, normalizeTicker } from "./symbols";
import type { ValafiHolding } from "./types";

const MAX_HOLDINGS = 25;
const PORTFOLIO_NAME = "Main Book";

export type RawHolding = { ticker: string; value: number };

export type EnsurePortfolioResult = {
  portfolioId: number | null;
  status: "cached" | "fresh" | "blocked" | "error" | "disabled" | "empty";
  holdings: ValafiHolding[];
};

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Aggregate by ticker, drop untrackable symbols, normalise weights to sum 1,
 *  keep the top holdings by weight. */
export function buildHoldings(raw: RawHolding[]): ValafiHolding[] {
  const byTicker = new Map<string, number>();
  for (const r of raw) {
    const ticker = normalizeTicker(r.ticker);
    if (!isTrackable(ticker) || !(r.value > 0)) continue;
    byTicker.set(ticker, (byTicker.get(ticker) ?? 0) + r.value);
  }

  const total = [...byTicker.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const top = [...byTicker.entries()]
    .map(([ticker, value]) => ({ ticker, weight: value / total }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_HOLDINGS);

  const cappedTotal = top.reduce((a, h) => a + h.weight, 0) || 1;
  return top.map((h) => ({ ticker: h.ticker, weight: round4(h.weight / cappedTotal) }));
}

function hashHoldings(holdings: ValafiHolding[]): string {
  const canon = holdings
    .map((h) => `${h.ticker}:${h.weight.toFixed(4)}`)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(canon).digest("hex").slice(0, 16);
}

export async function getRegisteredPortfolioId(tenantId: string): Promise<number | null> {
  const row = await prisma.valafiPortfolio.findUnique({ where: { tenantId } });
  return row?.portfolioId ?? null;
}

export async function ensurePortfolio(
  tenantId: string,
  raw: RawHolding[]
): Promise<EnsurePortfolioResult> {
  const holdings = buildHoldings(raw);
  const existing = await prisma.valafiPortfolio.findUnique({ where: { tenantId } });

  if (holdings.length === 0) {
    return { portfolioId: existing?.portfolioId ?? null, status: "empty", holdings: [] };
  }

  const hash = hashHoldings(holdings);
  if (existing && existing.holdingsHash === hash) {
    return { portfolioId: existing.portfolioId, status: "cached", holdings };
  }

  if (!api.valafiConfigured()) {
    return { portfolioId: existing?.portfolioId ?? null, status: "disabled", holdings };
  }

  const gate = await gateGlobalCall({ requestCost: 1 });
  if (!gate.ok) {
    return { portfolioId: existing?.portfolioId ?? null, status: "blocked", holdings };
  }

  try {
    const created = await api.createPortfolio(PORTFOLIO_NAME, holdings);
    await noteRequest(1);
    await prisma.valafiPortfolio.upsert({
      where: { tenantId },
      create: {
        tenantId,
        portfolioId: created.id,
        holdingsHash: hash,
        name: created.name ?? PORTFOLIO_NAME,
      },
      update: {
        portfolioId: created.id,
        holdingsHash: hash,
        name: created.name ?? PORTFOLIO_NAME,
        registeredAt: new Date(),
      },
    });
    return { portfolioId: created.id, status: "fresh", holdings };
  } catch (error) {
    await noteRequest(1); // the attempt still hit the provider
    logger.warn({ error: safeError(error) }, "valafi portfolio registration failed");
    return { portfolioId: existing?.portfolioId ?? null, status: "error", holdings };
  }
}
