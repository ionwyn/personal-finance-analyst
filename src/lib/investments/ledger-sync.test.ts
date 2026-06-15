import { describe, expect, it } from "vitest";
import { Prisma, type BrokerLedgerEntry } from "@prisma/client";

import { reconstructDailyCash } from "./performance";
import {
  bestLedgerMatch,
  canonicalTypeForSnapTrade,
  extractSnapTradeTicker,
  type CanonicalCandidate,
} from "./ledger-sync";

function entry(overrides: Partial<BrokerLedgerEntry> = {}): BrokerLedgerEntry {
  return {
    id: "entry-1",
    tenantId: "tenant-1",
    accountId: "account-1",
    accountExternalId: "external-1",
    accountType: "TFSA",
    tradeDate: new Date("2025-05-27T00:00:00.000Z"),
    settlementDate: null,
    activityType: "Trade",
    activitySubType: "BUY",
    symbol: "EEMV",
    symbolNorm: "EEMV",
    name: "EEMV",
    currency: "CAD",
    units: new Prisma.Decimal("0.4196"),
    unitPrice: new Prisma.Decimal("85.48214374"),
    cashAmount: new Prisma.Decimal("35.87"),
    nativeCashAmount: null,
    nativeCurrency: null,
    fxRate: null,
    dedupeKey: "csv-1",
    raw: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function candidate(overrides: Partial<CanonicalCandidate> = {}): CanonicalCandidate {
  return {
    tradeDate: new Date("2025-05-23T00:00:00.000Z"),
    settlementDate: null,
    activityType: "Trade",
    activitySubType: "BUY",
    symbol: "EEMV",
    symbolNorm: "EEMV",
    name: "EEMV",
    currency: "CAD",
    units: new Prisma.Decimal("0.4196"),
    unitPrice: new Prisma.Decimal("85.4862"),
    nativeCashAmount: new Prisma.Decimal("35.87"),
    nativeCurrency: "CAD",
    cashAmount: new Prisma.Decimal("35.87"),
    fxRate: new Prisma.Decimal(1),
    ...overrides,
  };
}

describe("canonicalTypeForSnapTrade", () => {
  it("maps every observed SnapTrade activity type", () => {
    const observed = [
      "BUY",
      "SELL",
      "DIVIDEND",
      "REI",
      "INTEREST",
      "STOCK_DIVIDEND",
      "CONTRIBUTION",
      "WITHDRAWAL",
      "TRANSFER",
      "EXTERNAL_ASSET_TRANSFER_IN",
      "EXTERNAL_ASSET_TRANSFER_OUT",
      "FEE",
      "TAX",
      "REIMBURSEMENT",
      "SPLIT",
      "ADJUSTMENT",
    ];
    expect(observed.every((type) => canonicalTypeForSnapTrade(type) != null)).toBe(true);
    expect(canonicalTypeForSnapTrade("TAX")).toEqual({
      activityType: "Fee",
      activitySubType: "TAX",
    });
  });

  it("quarantines unknown types", () => {
    expect(canonicalTypeForSnapTrade("UNKNOWN_PROVIDER_EVENT")).toBeNull();
  });
});

describe("extractSnapTradeTicker", () => {
  it.each([
    [{ symbol: { symbol: "BCE.TO" } }, null, "BCE"],
    [{ symbol: { raw_symbol: "ABR.VN" } }, null, "ABR"],
    [{ symbol: { symbol: "BRK.B" } }, null, "BRK.B"],
    [null, "Bought 1.25 of SHOP.TO at $100.00", "SHOP"],
    [null, "Received dividends from ZUAG.F.TO", "ZUAG.F"],
  ])("extracts normalized symbols", (raw, description, expected) => {
    expect(extractSnapTradeTicker(raw, description)).toBe(expected);
  });
});

describe("bestLedgerMatch", () => {
  it("matches provider dates across a weekend within three business days", () => {
    expect(bestLedgerMatch([entry()], candidate(), new Set()).entry?.id).toBe("entry-1");
  });

  it("does not collapse legitimate same-day duplicate trades", () => {
    const first = entry({ id: "entry-1", tradeDate: candidate().tradeDate });
    const second = entry({ id: "entry-2", tradeDate: candidate().tradeDate });
    const used = new Set<string>();
    const firstMatch = bestLedgerMatch([first, second], candidate(), used);
    expect(firstMatch.entry?.id).toBe("entry-1");
    used.add(firstMatch.entry!.id);
    expect(bestLedgerMatch([first, second], candidate(), used).entry?.id).toBe("entry-2");
  });

  it("ranks cash candidates by exact distance inside the tolerance", () => {
    const cashCandidate = candidate({
      activityType: "Interest",
      activitySubType: null,
      symbol: null,
      symbolNorm: null,
      units: new Prisma.Decimal(0),
      unitPrice: null,
      nativeCashAmount: new Prisma.Decimal("-0.0274"),
      cashAmount: new Prisma.Decimal("-0.0274"),
    });
    const twoCents = entry({
      id: "two",
      activityType: "Interest",
      activitySubType: null,
      symbol: null,
      symbolNorm: null,
      units: new Prisma.Decimal("0.02"),
      unitPrice: null,
      cashAmount: new Prisma.Decimal("-0.02"),
    });
    const threeCents = entry({
      id: "three",
      activityType: "Interest",
      activitySubType: null,
      symbol: null,
      symbolNorm: null,
      units: new Prisma.Decimal("0.03"),
      unitPrice: null,
      cashAmount: new Prisma.Decimal("-0.03"),
    });
    expect(bestLedgerMatch([twoCents, threeCents], cashCandidate, new Set()).entry?.id).toBe(
      "three"
    );
  });

  it("allows validated CSV transfer semantics to override a SnapTrade EFT label", () => {
    const transfer = entry({
      activityType: "MoneyMovement",
      activitySubType: "TRANSFER_TF",
      symbol: null,
      symbolNorm: null,
      units: new Prisma.Decimal(0),
      unitPrice: null,
      cashAmount: new Prisma.Decimal("7.22"),
    });
    const withdrawal = candidate({
      activityType: "MoneyMovement",
      activitySubType: "EFT",
      symbol: null,
      symbolNorm: null,
      units: new Prisma.Decimal(0),
      unitPrice: null,
      nativeCashAmount: new Prisma.Decimal("7.22"),
      cashAmount: new Prisma.Decimal("7.22"),
    });
    expect(bestLedgerMatch([transfer], withdrawal, new Set()).entry?.id).toBe("entry-1");
  });

  it("leaves non-identical equal-confidence candidates conflicted", () => {
    const dividend = candidate({
      activityType: "Dividend",
      activitySubType: null,
      symbol: "ZUAG.F",
      symbolNorm: "ZUAG.F",
      units: new Prisma.Decimal(0),
      unitPrice: null,
      nativeCashAmount: new Prisma.Decimal("-0.31"),
      cashAmount: new Prisma.Decimal("-0.31"),
    });
    const rows = [
      entry({
        id: "small",
        tradeDate: dividend.tradeDate,
        activityType: "Dividend",
        activitySubType: null,
        symbol: "ZUAG.F",
        symbolNorm: "ZUAG.F",
        units: new Prisma.Decimal("0.04"),
        unitPrice: null,
        cashAmount: new Prisma.Decimal("-0.04"),
      }),
      entry({
        id: "large",
        tradeDate: dividend.tradeDate,
        activityType: "Dividend",
        activitySubType: null,
        symbol: "ZUAG.F",
        symbolNorm: "ZUAG.F",
        units: new Prisma.Decimal("0.27"),
        unitPrice: null,
        cashAmount: new Prisma.Decimal("-0.27"),
      }),
    ];
    expect(bestLedgerMatch(rows, dividend, new Set())).toMatchObject({
      entry: null,
      conflict: "Ambiguous match between 2 canonical events",
    });
  });
});

describe("canonical dividend and tax cash", () => {
  it("keeps gross income and withholding tax separate while netting cash", () => {
    const cash = reconstructDailyCash(
      [
        {
          tradeDate: "2026-01-15",
          activityType: "Dividend",
          activitySubType: null,
          symbolNorm: "AAPL",
          units: 0,
          cashAmount: -10,
        },
        {
          tradeDate: "2026-01-15",
          activityType: "Fee",
          activitySubType: "TAX",
          symbolNorm: "AAPL",
          units: 0,
          cashAmount: 1.5,
        },
      ],
      "2026-01-15"
    );
    expect(cash).toEqual([{ date: "2026-01-15", cashCad: 8.5 }]);
  });
});
