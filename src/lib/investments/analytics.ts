import { loadInvestments } from "./loader";
import type {
  Allocation,
  InvestmentDashboardData
} from "./types";

const TYPE_COLORS: Record<string, string> = {
  ETF: "var(--invest)",
  Stock: "var(--cat-2)",
  ADR: "var(--cat-4)",
  "Mutual Fund": "var(--cat-5)",
  Bond: "var(--cat-6)",
  CEF: "var(--cat-7)",
  Crypto: "var(--cat-3)",
  Other: "var(--cat-8)"
};

const CCY_COLORS: Record<string, string> = {
  CAD: "var(--cat-1)",
  USD: "var(--cat-2)"
};

const FALLBACK_COLORS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)"
];

function fallbackColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

export async function getInvestmentDashboardData(tenantId?: string | null): Promise<InvestmentDashboardData> {
  const {
    accounts,
    holdings,
    cashBalances,
    fxUSDtoCAD,
    omittedPositionCount,
    connectionHealth,
    lastRunErrorMessage
  } = await loadInvestments(tenantId);

  const cashCAD = cashBalances.reduce((s, c) => s + c.valueCAD, 0);
  const holdingsCAD = holdings.reduce((s, h) => s + h.mvCAD, 0);
  const portfolioCAD = holdingsCAD + cashCAD;
  const costCAD = holdings.reduce((s, h) => s + (h.costCAD ?? 0), 0);
  const plCAD = holdings.reduce((s, h) => s + (h.plCAD ?? 0), 0);
  const plPct = costCAD === 0 ? 0 : (plCAD / costCAD) * 100;

  const lastSync = accounts.reduce<string | null>((acc, a) => {
    if (!a.lastSyncAt) return acc;
    if (!acc) return a.lastSyncAt;
    return a.lastSyncAt > acc ? a.lastSyncAt : acc;
  }, null);

  const summary = {
    institution: accounts[0]?.institution ?? "Wealthsimple",
    institutionLogoBg: accounts[0]?.institutionLogoBg ?? "#000000",
    institutionLogoText: accounts[0]?.institutionLogoText ?? "WS",
    accountCount: accounts.length,
    positionCount: holdings.length,
    portfolioCAD,
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
    failingConnectionCount: connectionHealth.failingConnectionCount
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
      color: TYPE_COLORS[name] ?? fallbackColor(name)
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
      color: CCY_COLORS[name] ?? fallbackColor(name)
    }))
    .sort((a, b) => b.value - a.value);

  return {
    summary,
    accounts,
    holdings,
    cashBalances,
    allocByType,
    allocByCcy
  };
}
