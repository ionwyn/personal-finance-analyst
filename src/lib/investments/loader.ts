import getAccountBalance from "@/lib/wealthsimple/mock/getAccountBalance";
import getAccountDetail from "@/lib/wealthsimple/mock/getAccountDetail";
import getAccountPositions from "@/lib/wealthsimple/mock/getAccountPositions";
import { FX_USD_TO_CAD, toCAD } from "./fx";
import type {
  AssetType,
  Currency,
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

function hashColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return LOGO_PALETTE[h % LOGO_PALETTE.length] ?? "#1f3a93";
}

function mapAssetType(code: string | undefined): AssetType {
  switch (code) {
    case "cs":
      return "Stock";
    case "et":
      return "ETF";
    case "ad":
      return "ADR";
    case "mf":
      return "Mutual Fund";
    default:
      return "Other";
  }
}

function asCurrency(code: string | undefined): Currency {
  return code === "USD" ? "USD" : "CAD";
}

type RawPosition = {
  symbol: {
    symbol: {
      id?: string;
      symbol: string;
      description: string;
      currency?: { code?: string };
      exchange?: { code?: string };
      type?: { code?: string };
    };
    id?: string;
  };
  price: number;
  units: number;
  average_purchase_price: number;
  currency?: { code?: string };
};

export type LoadedInvestments = {
  accounts: InvestmentAccount[];
  holdings: InvestmentPosition[];
  cashBalances: InvestmentCashBalance[];
};

export function loadInvestments(): LoadedInvestments {
  const detail = getAccountDetail;
  const positionsRaw = getAccountPositions as unknown as RawPosition[];
  const balancesRaw = getAccountBalance;

  const accountId = detail.id;
  const accountCcy = asCurrency(detail.meta?.currency);
  const lastSync =
    detail.sync_status?.holdings?.last_successful_sync ?? null;

  const cashTotal = balancesRaw.reduce((sum, b) => sum + b.cash, 0);

  const account: InvestmentAccount = {
    id: accountId,
    name: detail.name,
    registration: (detail.meta?.type ?? "").toUpperCase() || "TFSA",
    institution: detail.institution_name ?? "Wealthsimple",
    institutionLogoBg: "#000000",
    institutionLogoText: "WS",
    currency: accountCcy,
    totalValue: detail.balance?.total?.amount ?? 0,
    cash: cashTotal,
    openedAt: detail.opening_date ?? detail.created_date ?? null,
    lastSyncAt: lastSync,
    positionCount: positionsRaw.length,
    status: detail.status === "open" ? "IDLE" : "ERROR"
  };

  const holdings: InvestmentPosition[] = positionsRaw.map((p, idx) => {
    const sym = p.symbol.symbol;
    const ccy = asCurrency(sym.currency?.code ?? p.currency?.code);
    const units = p.units;
    const price = p.price;
    const avgCost = p.average_purchase_price;
    const mvNative = units * price;
    const costNative = units * avgCost;
    const mvCAD = toCAD(mvNative, ccy);
    const costCAD = toCAD(costNative, ccy);
    const plCAD = mvCAD - costCAD;
    const plPct = costCAD === 0 ? 0 : (plCAD / costCAD) * 100;

    return {
      id: sym.id ?? `${accountId}-${sym.symbol}-${idx}`,
      accountId,
      symbol: sym.symbol,
      description: sym.description,
      type: mapAssetType(sym.type?.code),
      exchange: sym.exchange?.code ?? "",
      currency: ccy,
      units,
      price,
      avgCost,
      mvNative,
      mvCAD,
      costNative,
      costCAD,
      plCAD,
      plPct,
      logoBg: hashColor(sym.symbol)
    };
  });

  const cashBalances: InvestmentCashBalance[] = balancesRaw.map((b) => {
    const ccy = asCurrency(b.currency?.code);
    return {
      currency: ccy,
      value: b.cash,
      valueCAD: toCAD(b.cash, ccy),
      buyingPower: b.buying_power
    };
  });

  return {
    accounts: [account],
    holdings,
    cashBalances
  };
}

export { FX_USD_TO_CAD };
