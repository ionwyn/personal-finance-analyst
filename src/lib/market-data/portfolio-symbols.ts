export type PortfolioSecurity = {
  ledgerSymbol: string;
  marketSymbol: string;
  currency: "CAD" | "USD";
};

const CAD_SUFFIXED = [
  "CCO",
  "CLS",
  "CNQ",
  "CVE",
  "HPS.A",
  "KILO.B",
  "PDF",
  "PHR",
  "QAH",
  "QCN",
  "QUU",
  "VEQT",
  "VFV",
  "VUS",
  "XEF",
  "XIC",
  "XSH",
  "ZAG",
  "ZCB",
  "ZCS",
  "ZEA",
  "ZFL",
  "ZFM",
  "ZHY",
  "ZUAG.F",
] as const;

const USD = [
  "AAPL",
  "ACWV",
  "AMZN",
  "EEMV",
  "GEV",
  "GLDM",
  "GOOG",
  "GSWO",
  "IEFA",
  "IEMG",
  "META",
  "MRVL",
  "MSFT",
  "NVDA",
  "SMH",
  "SPOT",
  "TSLA",
  "TSM",
  "TTWO",
  "VRT",
  "VSEC",
  "VTI",
] as const;

const securities: PortfolioSecurity[] = [
  ...CAD_SUFFIXED.map((ledgerSymbol) => ({
    ledgerSymbol,
    marketSymbol: `${ledgerSymbol}.TO`,
    currency: "CAD" as const,
  })),
  ...USD.map((ledgerSymbol) => ({
    ledgerSymbol,
    marketSymbol: ledgerSymbol,
    currency: "USD" as const,
  })),
  { ledgerSymbol: "ABR", marketSymbol: "ABR.V", currency: "CAD" },
  { ledgerSymbol: "QTIP", marketSymbol: "QTIP.NE", currency: "CAD" },
];

const byLedgerSymbol = new Map(
  securities.map((security) => [security.ledgerSymbol, security] as const)
);

export const PORTFOLIO_SECURITIES = [...securities].sort((left, right) =>
  left.ledgerSymbol.localeCompare(right.ledgerSymbol)
);

export function resolvePortfolioSecurity(symbol: string): PortfolioSecurity | null {
  return byLedgerSymbol.get(symbol.trim().toUpperCase().replace(/\.TO$/, "")) ?? null;
}
