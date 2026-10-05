import { getInvestmentDashboardData } from "@/lib/investments/analytics";

export type InvestmentExposureHolding = {
  symbol: string;
  description: string;
  value: number;
  weightPct: number;
  plPct: number | null;
  type: string;
  currency: string;
  accountCount: number;
};

export type InvestmentExposureResult = {
  portfolioValue: number;
  holdingsValue: number;
  cashValue: number;
  liabilityValue: number;
  netWorthValue: number;
  positionCount: number;
  accountCount: number;
  lastSync: string | null;
  concentration: {
    top1Pct: number;
    top3Pct: number;
    top5Pct: number;
    top10Pct: number;
  };
  topHoldings: InvestmentExposureHolding[];
  allocationByType: { name: string; value: number; pct: number }[];
  allocationByCurrency: { name: string; value: number; pct: number }[];
  sectorExposure: { name: string; value: number; pct: number; pnl: number | null }[];
  accountExposure: { name: string; institution: string; value: number; pct: number; tracked: boolean }[];
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-CA")}`;
}

function pct(value: number) {
  return `${round(value).toLocaleString("en-CA")}%`;
}

function sumTop(rows: { weightPct: number }[], count: number) {
  return round(rows.slice(0, count).reduce((sum, row) => sum + row.weightPct, 0));
}

export async function fetchInvestmentExposure(
  tenantId: string
): Promise<InvestmentExposureResult> {
  const data = await getInvestmentDashboardData(tenantId);
  const portfolioValue = round(data.summary.portfolioCAD);
  const holdingsValue = round(data.holdings.reduce((sum, holding) => sum + holding.mvCAD, 0));
  const denominator = portfolioValue > 0 ? portfolioValue : holdingsValue || 1;

  const bySymbol = new Map<
    string,
    {
      description: string;
      value: number;
      plWeightedNumerator: number;
      plWeightedDenominator: number;
      type: string;
      currency: string;
      accountIds: Set<string>;
    }
  >();

  for (const holding of data.holdings) {
    const existing = bySymbol.get(holding.symbol);
    if (existing) {
      existing.value += holding.mvCAD;
      if (holding.plPct != null) {
        existing.plWeightedNumerator += holding.plPct * holding.mvCAD;
        existing.plWeightedDenominator += holding.mvCAD;
      }
      existing.accountIds.add(holding.accountId);
    } else {
      bySymbol.set(holding.symbol, {
        description: holding.description,
        value: holding.mvCAD,
        plWeightedNumerator: holding.plPct == null ? 0 : holding.plPct * holding.mvCAD,
        plWeightedDenominator: holding.plPct == null ? 0 : holding.mvCAD,
        type: holding.type,
        currency: holding.currency,
        accountIds: new Set([holding.accountId]),
      });
    }
  }

  const topHoldings = [...bySymbol.entries()]
    .map(([symbol, row]) => ({
      symbol,
      description: row.description,
      value: round(row.value),
      weightPct: round((row.value / denominator) * 100),
      plPct:
        row.plWeightedDenominator > 0
          ? round(row.plWeightedNumerator / row.plWeightedDenominator)
          : null,
      type: row.type,
      currency: row.currency,
      accountCount: row.accountIds.size,
    }))
    .sort((a, b) => b.value - a.value);

  const accountDenominator =
    data.accounts.reduce((sum, account) => sum + Math.max(0, account.totalValue), 0) || 1;

  return {
    portfolioValue,
    holdingsValue,
    cashValue: round(data.summary.cashCAD),
    liabilityValue: round(data.summary.liabilitiesCAD),
    netWorthValue: round(data.summary.netWorthCAD),
    positionCount: data.summary.positionCount,
    accountCount: data.summary.accountCount,
    lastSync: data.summary.lastSync,
    concentration: {
      top1Pct: sumTop(topHoldings, 1),
      top3Pct: sumTop(topHoldings, 3),
      top5Pct: sumTop(topHoldings, 5),
      top10Pct: sumTop(topHoldings, 10),
    },
    topHoldings: topHoldings.slice(0, 12),
    allocationByType: data.allocByType
      .map((row) => ({ name: row.name, value: round(row.value), pct: round(row.pct) }))
      .slice(0, 8),
    allocationByCurrency: data.allocByCcy
      .map((row) => ({ name: row.name, value: round(row.value), pct: round(row.pct) }))
      .slice(0, 8),
    sectorExposure: data.sectors
      .map((row) => ({
        name: row.name,
        value: round(row.mvCad),
        pct: round(row.weightPct),
        pnl: row.pnlCad == null ? null : round(row.pnlCad),
      }))
      .slice(0, 8),
    accountExposure: data.accounts
      .map((account) => ({
        name: account.name,
        institution: account.institution,
        value: round(account.totalValue),
        pct: round((Math.max(0, account.totalValue) / accountDenominator) * 100),
        tracked: account.tracked,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };
}

export function serializeInvestmentExposure(
  result: InvestmentExposureResult,
  currency = "CAD"
): string {
  const lines = [
    "INVESTMENT EXPOSURE STATUS - server-computed portfolio exposure, allocation, concentration, and account/holding summaries. This is descriptive only, not investment advice:",
    `- Portfolio value ${money(result.portfolioValue, currency)}; holdings ${money(result.holdingsValue, currency)}; cash ${money(result.cashValue, currency)}; liabilities ${money(result.liabilityValue, currency)}; net worth ${money(result.netWorthValue, currency)}`,
    `- Accounts ${result.accountCount}; positions ${result.positionCount}; last sync ${result.lastSync ?? "n/a"}`,
    `- Concentration by holding: top 1 ${pct(result.concentration.top1Pct)}; top 3 ${pct(result.concentration.top3Pct)}; top 5 ${pct(result.concentration.top5Pct)}; top 10 ${pct(result.concentration.top10Pct)}`,
  ];

  if (result.topHoldings.length > 0) {
    lines.push("", "TOP HOLDINGS BY PORTFOLIO WEIGHT:");
    for (const row of result.topHoldings) {
      lines.push(
        `- ${row.symbol} (${row.description}): ${money(row.value, currency)}; weight ${pct(row.weightPct)}; return ${row.plPct == null ? "n/a" : pct(row.plPct)}; type ${row.type}; currency ${row.currency}; accounts ${row.accountCount}`
      );
    }
  }

  if (result.allocationByType.length > 0) {
    lines.push("", "ALLOCATION BY TYPE:");
    for (const row of result.allocationByType) {
      lines.push(`- ${row.name}: ${money(row.value, currency)}; ${pct(row.pct)}`);
    }
  }

  if (result.allocationByCurrency.length > 0) {
    lines.push("", "ALLOCATION BY CURRENCY:");
    for (const row of result.allocationByCurrency) {
      lines.push(`- ${row.name}: ${money(row.value, currency)}; ${pct(row.pct)}`);
    }
  }

  if (result.sectorExposure.length > 0) {
    lines.push("", "SECTOR EXPOSURE:");
    for (const row of result.sectorExposure) {
      lines.push(
        `- ${row.name}: ${money(row.value, currency)}; ${pct(row.pct)}; P&L ${row.pnl == null ? "n/a" : money(row.pnl, currency)}`
      );
    }
  }

  if (result.accountExposure.length > 0) {
    lines.push("", "ACCOUNT EXPOSURE:");
    for (const row of result.accountExposure) {
      lines.push(
        `- ${row.name}: ${row.institution}; value ${money(row.value, currency)}; share ${pct(row.pct)}; tracked ${row.tracked ? "yes" : "no"}`
      );
    }
  }

  return lines.join("\n");
}
