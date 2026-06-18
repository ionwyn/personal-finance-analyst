import { getMarketDataService } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";

import { loadInvestments } from "./loader";
import type {
  Allocation,
  ContributionData,
  ContributionMonth,
  ContributionYear,
  InvestmentDashboardData,
  SectorSlice,
} from "./types";

const TYPE_COLORS: Record<string, string> = {
  ETF: "var(--invest)",
  Stock: "var(--cat-2)",
  ADR: "var(--cat-4)",
  "Mutual Fund": "var(--cat-5)",
  Bond: "var(--cat-6)",
  CEF: "var(--cat-7)",
  Crypto: "var(--cat-3)",
  Other: "var(--cat-8)",
};

const CCY_COLORS: Record<string, string> = {
  CAD: "var(--cat-1)",
  USD: "var(--cat-2)",
};

const FALLBACK_COLORS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)",
];

const FUND_TYPES = new Set(["ETF", "MUTUAL FUND", "CEF", "FUND"]);

function fallbackColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

async function fetchSectors(
  tenantId: string,
  holdings: { symbol: string; type: string; mvCAD: number }[]
): Promise<SectorSlice[]> {
  const bySymbol = new Map<string, { type: string; mvCad: number; pnlCad: number | null }>();
  for (const h of holdings) {
    const cur = bySymbol.get(h.symbol);
    if (cur) {
      cur.mvCad += h.mvCAD;
      if (h.plCAD != null) cur.pnlCad = (cur.pnlCad ?? 0) + h.plCAD;
    } else {
      bySymbol.set(h.symbol, { type: h.type, mvCad: h.mvCAD, pnlCad: h.plCAD ?? null });
    }
  }
  const symbols = [...bySymbol.keys()];
  if (symbols.length === 0) return [];

  const totalMv = [...bySymbol.values()].reduce((s, v) => s + v.mvCad, 0);
  if (totalMv <= 0) return [];

  const svc = getMarketDataService();
  const profiles = await svc.getProfiles(symbols).catch(() => symbols.map(() => null));

  const sectorMv = new Map<string, { mv: number; pnl: number | null }>();
  symbols.forEach((sym, i) => {
    const entry = bySymbol.get(sym)!;
    const sector =
      profiles[i]?.sector ??
      (FUND_TYPES.has(entry.type.toUpperCase()) ? "Funds & ETFs" : "Unclassified");
    const cur = sectorMv.get(sector);
    if (cur) {
      cur.mv += entry.mvCad;
      if (entry.pnlCad != null) cur.pnl = (cur.pnl ?? 0) + entry.pnlCad;
    } else {
      sectorMv.set(sector, { mv: entry.mvCad, pnl: entry.pnlCad });
    }
  });

  return [...sectorMv.entries()]
    .map(([name, { mv: mvCad, pnl: pnlCad }]) => ({
      name,
      mvCad,
      weightPct: (mvCad / totalMv) * 100,
      pnlCad,
    }))
    .sort((a, b) => b.mvCad - a.mvCad);
}

const EMPTY_CONTRIBUTIONS: ContributionData = {
  lifetimeNetCad: 0,
  lifetimeContributionCad: 0,
  lifetimeWithdrawalCad: 0,
  years: [],
};

async function fetchContributions(tenantId: string): Promise<ContributionData> {
  const raw = await prisma.brokerLedgerEntry.findMany({
    where: {
      tenantId,
      activityType: "MoneyMovement",
      account: { is: { tracked: true } },
    },
    select: { cashAmount: true, tradeDate: true },
    orderBy: { tradeDate: "asc" },
  });

  const yearMap = new Map<number, Map<string, { contrib: number; withdrawal: number }>>();

  for (const entry of raw) {
    if (!entry.cashAmount || !entry.tradeDate) continue;
    const amount = entry.cashAmount.toNumber();
    const date = entry.tradeDate;
    const year = date.getUTCFullYear();
    const month = date.toISOString().slice(0, 7);

    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const monthMap = yearMap.get(year)!;
    if (!monthMap.has(month)) monthMap.set(month, { contrib: 0, withdrawal: 0 });
    const slot = monthMap.get(month)!;

    // App convention: negative cashAmount = credit = money IN (contribution)
    //                 positive cashAmount = debit = money OUT (withdrawal)
    if (amount < 0) slot.contrib += Math.abs(amount);
    else slot.withdrawal += amount;
  }

  let lifetimeContrib = 0;
  let lifetimeWithdrawal = 0;
  const years: ContributionYear[] = [];

  for (const [year, monthMap] of [...yearMap.entries()].sort((a, b) => b[0] - a[0])) {
    let yearContrib = 0;
    let yearWithdrawal = 0;
    const months: ContributionMonth[] = [];

    for (const [month, slot] of [...monthMap.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
      yearContrib += slot.contrib;
      yearWithdrawal += slot.withdrawal;
      months.push({ month, contributionCad: slot.contrib, withdrawalCad: slot.withdrawal });
    }

    lifetimeContrib += yearContrib;
    lifetimeWithdrawal += yearWithdrawal;
    years.push({
      year,
      contributionCad: yearContrib,
      withdrawalCad: yearWithdrawal,
      netCad: yearContrib - yearWithdrawal,
      months,
    });
  }

  return {
    lifetimeNetCad: lifetimeContrib - lifetimeWithdrawal,
    lifetimeContributionCad: lifetimeContrib,
    lifetimeWithdrawalCad: lifetimeWithdrawal,
    years,
  };
}

export async function getInvestmentDashboardData(
  tenantId?: string | null
): Promise<InvestmentDashboardData> {
  return getInvestmentDashboardDataWithOptions(tenantId, {
    includeSectors: true,
    includeContributions: true,
  });
}

export async function getPortfolioHoldingsData(
  tenantId?: string | null
): Promise<InvestmentDashboardData> {
  return getInvestmentDashboardDataWithOptions(tenantId, {
    includeSectors: false,
    includeContributions: false,
  });
}

export async function getPortfolioContributionData(
  tenantId?: string | null
): Promise<ContributionData> {
  if (!tenantId) return EMPTY_CONTRIBUTIONS;
  return fetchContributions(tenantId);
}

async function getInvestmentDashboardDataWithOptions(
  tenantId: string | null | undefined,
  options: { includeSectors: boolean; includeContributions: boolean }
): Promise<InvestmentDashboardData> {
  const {
    accounts,
    connections,
    holdings,
    cashBalances,
    fxUSDtoCAD,
    omittedPositionCount,
    connectionHealth,
    lastRunErrorMessage,
  } = await loadInvestments(tenantId);

  const cashCAD = cashBalances.reduce((s, c) => s + c.valueCAD, 0);
  const holdingsCAD = holdings.reduce((s, h) => s + h.mvCAD, 0);
  const portfolioCAD = holdingsCAD + cashCAD;

  const trackedAccounts = accounts.filter((a) => a.tracked);
  const liabilitiesCAD = trackedAccounts.reduce((s, a) => s + a.liabilityCAD, 0);
  const netWorthCAD = trackedAccounts.reduce((s, a) => s + a.totalValue, 0);
  const assetsCAD = netWorthCAD + liabilitiesCAD;
  const costCAD = holdings.reduce((s, h) => s + (h.costCAD ?? 0), 0);
  const plCAD = holdings.reduce((s, h) => s + (h.plCAD ?? 0), 0);
  const plPct = costCAD === 0 ? 0 : (plCAD / costCAD) * 100;

  const lastSync = accounts.reduce<string | null>((acc, a) => {
    if (!a.lastSyncAt) return acc;
    if (!acc) return a.lastSyncAt;
    return a.lastSyncAt > acc ? a.lastSyncAt : acc;
  }, null);

  const [sectors, contributions] = await Promise.all([
    tenantId && options.includeSectors
      ? fetchSectors(tenantId, holdings)
      : Promise.resolve([] as SectorSlice[]),
    tenantId && options.includeContributions
      ? fetchContributions(tenantId)
      : Promise.resolve(EMPTY_CONTRIBUTIONS),
  ]);

  const summary = {
    institution: accounts[0]?.institution ?? "Unknown Institution",
    institutionLogoBg: accounts[0]?.institutionLogoBg ?? "#000000",
    institutionLogoText: accounts[0]?.institutionLogoText ?? "WS",
    accountCount: accounts.length,
    positionCount: holdings.length,
    portfolioCAD,
    assetsCAD,
    liabilitiesCAD,
    netWorthCAD,
    costCAD,
    plCAD,
    plPct,
    cashCAD,
    cashByCcy: cashBalances,
    lastSync,
    fxUSDtoCAD,
    omittedPositionCount,
    status: connectionHealth.status,
    errorCode: connectionHealth.errorCode,
    errorMessage: connectionHealth.errorMessage ?? lastRunErrorMessage,
    connectionCount: connectionHealth.connectionCount,
    failingConnectionCount: connectionHealth.failingConnectionCount,
  };

  const totalAlloc = holdingsCAD || 1;

  const byType = new Map<string, number>();
  for (const h of holdings) {
    byType.set(h.type, (byType.get(h.type) ?? 0) + h.mvCAD);
  }
  const allocByType: Allocation[] = Array.from(byType.entries())
    .map(([name, value]) => ({
      name,
      value,
      pct: (value / totalAlloc) * 100,
      color: TYPE_COLORS[name] ?? fallbackColor(name),
    }))
    .sort((a, b) => b.value - a.value);

  const byCcy = new Map<string, number>();
  for (const h of holdings) {
    byCcy.set(h.currency, (byCcy.get(h.currency) ?? 0) + h.mvCAD);
  }
  const allocByCcy: Allocation[] = Array.from(byCcy.entries())
    .map(([name, value]) => ({
      name,
      value,
      pct: (value / totalAlloc) * 100,
      color: CCY_COLORS[name] ?? fallbackColor(name),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    summary,
    accounts,
    connections,
    holdings,
    cashBalances,
    allocByType,
    allocByCcy,
    sectors,
    contributions,
  };
}
