import { FX_USD_TO_CAD, loadInvestments } from "./loader";
import type {
  Allocation,
  AssetType,
  Currency,
  InvestmentDashboardData
} from "./types";

const TYPE_COLORS: Record<AssetType, string> = {
  ETF: "var(--invest)",
  Stock: "var(--cat-2)",
  ADR: "var(--cat-4)",
  "Mutual Fund": "var(--cat-5)",
  Other: "var(--cat-8)"
};

const CCY_COLORS: Record<Currency, string> = {
  CAD: "var(--cat-1)",
  USD: "var(--cat-2)"
};

export function getInvestmentDashboardData(): InvestmentDashboardData {
  const { accounts, holdings, cashBalances } = loadInvestments();

  const cashCAD = cashBalances.reduce((s, c) => s + c.valueCAD, 0);
  const holdingsCAD = holdings.reduce((s, h) => s + h.mvCAD, 0);
  const portfolioCAD = holdingsCAD + cashCAD;
  const costCAD = holdings.reduce((s, h) => s + h.costCAD, 0);
  const plCAD = holdings.reduce((s, h) => s + h.plCAD, 0);
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
    fxUSDtoCAD: FX_USD_TO_CAD
  };

  const totalAlloc = holdingsCAD || 1;

  const byType = new Map<AssetType, number>();
  for (const h of holdings) {
    byType.set(h.type, (byType.get(h.type) ?? 0) + h.mvCAD);
  }
  const allocByType: Allocation[] = Array.from(byType.entries())
    .map(([name, value]) => ({
      name,
      value,
      pct: (value / totalAlloc) * 100,
      color: TYPE_COLORS[name] ?? "var(--cat-8)"
    }))
    .sort((a, b) => b.value - a.value);

  const byCcy = new Map<Currency, number>();
  for (const h of holdings) {
    byCcy.set(h.currency, (byCcy.get(h.currency) ?? 0) + h.mvCAD);
  }
  const allocByCcy: Allocation[] = Array.from(byCcy.entries())
    .map(([name, value]) => ({
      name,
      value,
      pct: (value / totalAlloc) * 100,
      color: CCY_COLORS[name] ?? "var(--cat-8)"
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
