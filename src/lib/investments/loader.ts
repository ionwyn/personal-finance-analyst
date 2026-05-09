import { prisma } from "@/lib/prisma";
import type {
  InvestmentAccount,
  InvestmentCashBalance,
  InvestmentPosition
} from "./types";

const LOGO_PALETTE = [
  "#a6192e",
  "#0072c6",
  "#1d1d1f",
  "#0d8b3e",
  "#00a4ef",
  "#ed1a3b",
  "#7ab55c",
  "#4285f4",
  "#ff6a00",
  "#76b900",
  "#1f3a93",
  "#003168",
  "#ff9900",
  "#0668e1",
  "#cc0000",
  "#e21c2c",
  "#000000"
];

function hashColor(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return LOGO_PALETTE[h % LOGO_PALETTE.length] ?? "#1f3a93";
}

function numberValue(value: { toNumber(): number } | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function nullableNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function logoText(name: string | null | undefined) {
  return (name ?? "ST")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "ST";
}

export type LoadedInvestments = {
  accounts: InvestmentAccount[];
  holdings: InvestmentPosition[];
  cashBalances: InvestmentCashBalance[];
  fxUSDtoCAD: number | null;
  omittedPositionCount: number;
};

export async function loadInvestments(tenantId?: string | null): Promise<LoadedInvestments> {
  if (!tenantId) {
    return {
      accounts: [],
      holdings: [],
      cashBalances: [],
      fxUSDtoCAD: null,
      omittedPositionCount: 0
    };
  }

  const [accountsRaw, usdCad, lastSyncRun] = await Promise.all([
    prisma.snapTradeAccount.findMany({
      where: { tenantId },
      orderBy: [{ institutionName: "asc" }, { name: "asc" }],
      include: {
        connection: true,
        balances: true,
        positions: {
          orderBy: { marketValueCad: "desc" },
          include: { logo: true }
        }
      }
    }),
    prisma.snapTradeFxRate.findUnique({ where: { pair: "USD-CAD" } }),
    prisma.snapTradeSyncRun.findFirst({
      where: { tenantId },
      orderBy: { startedAt: "desc" }
    })
  ]);

  const accounts: InvestmentAccount[] = accountsRaw.map((account) => {
    const holdingsCAD = account.positions.reduce(
      (sum, position) => sum + numberValue(position.marketValueCad),
      0
    );
    const cashCAD = account.balances.reduce((sum, balance) => sum + numberValue(balance.cashCad), 0);
    const institution = account.institutionName ?? account.connection.brokerageName ?? "SnapTrade";
    const status = account.connection.status === "DISABLED" || account.status === "closed"
      ? "DISABLED"
      : account.connection.status;

    return {
      id: account.id,
      connectionId: account.connectionId,
      name: account.name,
      registration: (account.rawType ?? account.accountCategory ?? "Brokerage").toUpperCase(),
      institution,
      institutionLogoBg: hashColor(institution),
      institutionLogoText: logoText(institution),
      currency: account.currency ?? "CAD",
      totalValue: holdingsCAD + cashCAD,
      cash: cashCAD,
      openedAt: account.openedAt?.toISOString() ?? account.snapTradeCreatedAt?.toISOString() ?? null,
      lastSyncAt: account.lastHoldingsSyncAt?.toISOString() ?? account.connection.lastSyncAt?.toISOString() ?? null,
      positionCount: account.positions.length,
      status
    };
  });

  const holdings: InvestmentPosition[] = accountsRaw.flatMap((account) =>
    account.positions.map((position): InvestmentPosition => ({
      id: position.id,
      accountId: account.id,
      symbol: position.symbol,
      description: position.description ?? position.symbol,
      type: position.assetType,
      exchange: position.exchange ?? "",
      currency: position.currency,
      units: numberValue(position.units),
      price: numberValue(position.price),
      avgCost: nullableNumber(position.avgCost),
      mvNative: numberValue(position.marketValueNative),
      mvCAD: numberValue(position.marketValueCad),
      costNative: nullableNumber(position.costNative),
      costCAD: nullableNumber(position.costCad),
      plCAD: nullableNumber(position.pnlCad),
      plPct: nullableNumber(position.pnlPct),
      logoBg: hashColor(position.symbol),
      logoId: position.logo?.status === "READY" || position.logoId ? position.logoId : null
    }))
  );

  const cashByCurrency = new Map<string, InvestmentCashBalance>();
  for (const account of accountsRaw) {
    for (const balance of account.balances) {
      const existing = cashByCurrency.get(balance.currency);
      const value = numberValue(balance.cash);
      const valueCAD = numberValue(balance.cashCad);
      const buyingPower = numberValue(balance.buyingPower);
      if (existing) {
        existing.value += value;
        existing.valueCAD += valueCAD;
        existing.buyingPower += buyingPower;
      } else {
        cashByCurrency.set(balance.currency, {
          currency: balance.currency,
          value,
          valueCAD,
          buyingPower
        });
      }
    }
  }

  return {
    accounts,
    holdings,
    cashBalances: [...cashByCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    fxUSDtoCAD: usdCad?.rate.toNumber() ?? null,
    omittedPositionCount: lastSyncRun?.omittedPositionsCount ?? 0
  };
}
