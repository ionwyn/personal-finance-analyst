import { describe, expect, it } from "vitest";

import {
  addCashToValueSeries,
  externalFlows,
  mwr,
  mwrNpv,
  reconstructDailyCash,
  reconstructDailyHoldings,
  restateHoldingsForSplitAdjustedPrices,
  twr,
  valueSeries,
  type DailyValue,
  type PerformanceLedgerEntry,
} from "./performance";

function entry(
  partial: Partial<PerformanceLedgerEntry> &
    Pick<PerformanceLedgerEntry, "tradeDate" | "activityType">
): PerformanceLedgerEntry {
  return {
    activitySubType: null,
    symbolNorm: null,
    units: 0,
    cashAmount: null,
    ...partial,
  };
}

function dailyValues(start: string, end: string, valueOf: (date: string) => number): DailyValue[] {
  const values: DailyValue[] = [];
  for (
    let time = Date.parse(`${start}T00:00:00.000Z`);
    time <= Date.parse(`${end}T00:00:00.000Z`);
    time += 24 * 60 * 60 * 1000
  ) {
    const date = new Date(time).toISOString().slice(0, 10);
    values.push({ date, valueCad: valueOf(date) });
  }
  return values;
}

describe("reconstructDailyHoldings", () => {
  it("walks unit-affecting events forward with exact 8-decimal accumulation", () => {
    const holdings = reconstructDailyHoldings(
      [
        entry({
          tradeDate: "2024-01-02",
          activityType: "Trade",
          activitySubType: "BUY",
          symbolNorm: "ABC",
          units: "10.00000001",
        }),
        entry({
          tradeDate: "2024-01-03",
          activityType: "LegacyCorporateAction",
          activitySubType: "SPLIT",
          symbolNorm: "ABC",
          units: "9.99999999",
        }),
        entry({
          tradeDate: "2024-01-04",
          activityType: "Trade",
          activitySubType: "SELL",
          symbolNorm: "ABC",
          units: "-20",
        }),
      ],
      "2024-01-05"
    );

    expect(holdings).toEqual([
      { date: "2024-01-02", units: { ABC: 10.00000001 } },
      { date: "2024-01-03", units: { ABC: 20 } },
      { date: "2024-01-04", units: {} },
      { date: "2024-01-05", units: {} },
    ]);
  });

  it("ignores dividends until the recorded DRIP buy adds fractional units", () => {
    const holdings = reconstructDailyHoldings(
      [
        entry({
          tradeDate: "2024-04-01",
          activityType: "Trade",
          activitySubType: "BUY",
          symbolNorm: "VFV",
          units: 10,
        }),
        entry({
          tradeDate: "2024-04-02",
          activityType: "Dividend",
          symbolNorm: "VFV",
          units: "4.35",
          cashAmount: "-4.35",
        }),
        entry({
          tradeDate: "2024-04-04",
          activityType: "Trade",
          activitySubType: "BUY",
          symbolNorm: "VFV",
          units: "0.0325",
          cashAmount: "4.35",
        }),
      ],
      "2024-04-04"
    );

    expect(holdings.map((holding) => holding.units.VFV)).toEqual([10, 10, 10, 10.0325]);
  });

  it("nets household internal security transfers and applies name changes", () => {
    const holdings = reconstructDailyHoldings(
      [
        entry({
          tradeDate: "2024-01-01",
          activityType: "Trade",
          activitySubType: "BUY",
          symbolNorm: "GLDM",
          units: 5,
        }),
        entry({
          tradeDate: "2024-01-02",
          activityType: "InternalSecurityTransfer",
          symbolNorm: "GLDM",
          units: -5,
        }),
        entry({
          tradeDate: "2024-01-02",
          activityType: "InternalSecurityTransfer",
          symbolNorm: "GLDM",
          units: 5,
        }),
        entry({
          tradeDate: "2024-01-03",
          activityType: "LegacyCorporateAction",
          activitySubType: "NAME_CHANGE",
          symbolNorm: "GLDM",
          units: "-0.5",
        }),
        entry({
          tradeDate: "2024-01-03",
          activityType: "LegacyCorporateAction",
          activitySubType: "NAME_CHANGE",
          symbolNorm: "GLDM",
          units: "0.5",
        }),
      ],
      "2024-01-03"
    );

    expect(holdings.at(-1)?.units).toEqual({ GLDM: 5 });
  });

  it("rejects a unit-affecting entry without a symbol", () => {
    expect(() =>
      reconstructDailyHoldings(
        [
          entry({
            tradeDate: "2024-01-01",
            activityType: "Trade",
            activitySubType: "BUY",
            units: 1,
          }),
        ],
        "2024-01-01"
      )
    ).toThrow("has no normalized symbol");
  });
});

describe("reconstructDailyCash", () => {
  it("walks every cash-affecting ledger entry using the app sign convention", () => {
    const ledger = [
      entry({
        tradeDate: "2024-01-01",
        activityType: "MoneyMovement",
        activitySubType: "EFT",
        cashAmount: -100,
      }),
      entry({
        tradeDate: "2024-01-02",
        activityType: "Trade",
        activitySubType: "BUY",
        symbolNorm: "ABC",
        units: 1,
        cashAmount: 60,
      }),
      entry({
        tradeDate: "2024-01-02",
        activityType: "Dividend",
        cashAmount: -5,
      }),
      entry({
        tradeDate: "2024-01-02",
        activityType: "Fee",
        cashAmount: 1,
      }),
      entry({
        tradeDate: "2024-01-03",
        activityType: "Trade",
        activitySubType: "SELL",
        symbolNorm: "ABC",
        units: -1,
        cashAmount: -20,
      }),
      entry({
        tradeDate: "2024-01-03",
        activityType: "LegacyCorporateAction",
        activitySubType: "SPLIT",
        symbolNorm: "ABC",
        units: 1,
        cashAmount: null,
      }),
    ];

    expect(reconstructDailyCash(ledger, "2024-01-04")).toEqual([
      { date: "2024-01-01", cashCad: 100 },
      { date: "2024-01-02", cashCad: 44 },
      { date: "2024-01-03", cashCad: 64 },
      { date: "2024-01-04", cashCad: 64 },
    ]);
  });

  it("nets household internal cash transfers", () => {
    expect(
      reconstructDailyCash(
        [
          entry({
            tradeDate: "2024-01-01",
            activityType: "MoneyMovement",
            activitySubType: "TRANSFER_TF",
            cashAmount: 50,
          }),
          entry({
            tradeDate: "2024-01-01",
            activityType: "MoneyMovement",
            activitySubType: "TRANSFER_TF",
            cashAmount: -50,
          }),
        ],
        "2024-01-01"
      )
    ).toEqual([{ date: "2024-01-01", cashCad: 0 }]);
  });
});

describe("restateHoldingsForSplitAdjustedPrices", () => {
  it("restates pre-split units and preserves post-split units", () => {
    const ledger = [
      entry({
        tradeDate: "2024-01-01",
        activityType: "Trade",
        activitySubType: "BUY",
        symbolNorm: "ABC",
        units: 2,
      }),
      entry({
        tradeDate: "2024-01-03",
        activityType: "LegacyCorporateAction",
        activitySubType: "SPLIT",
        symbolNorm: "ABC",
        units: 18,
      }),
    ];
    const holdings = reconstructDailyHoldings(ledger, "2024-01-04");

    expect(restateHoldingsForSplitAdjustedPrices(holdings, ledger)).toEqual([
      { date: "2024-01-01", units: { ABC: 20 } },
      { date: "2024-01-02", units: { ABC: 20 } },
      { date: "2024-01-03", units: { ABC: 20 } },
      { date: "2024-01-04", units: { ABC: 20 } },
    ]);
  });
});

describe("valueSeries", () => {
  it("values CAD and USD holdings with forward-filled closes and FX", () => {
    const values = valueSeries(
      [
        { date: "2024-01-01", units: {} },
        { date: "2024-01-02", units: { CADF: 2, USSF: 1 } },
        { date: "2024-01-03", units: { CADF: 2, USSF: 1 } },
        { date: "2024-01-04", units: { CADF: 2, USSF: 1 } },
      ],
      {
        CADF: {
          currency: "CAD",
          points: [
            { date: "2024-01-02", close: 10 },
            { date: "2024-01-04", close: 12 },
          ],
        },
        USSF: {
          currency: "USD",
          points: [{ date: "2024-01-03", close: 5 }],
        },
      },
      [{ date: "2024-01-03", rate: 1.3 }]
    );

    expect(values).toEqual([
      { date: "2024-01-01", valueCad: 0 },
      { date: "2024-01-03", valueCad: 26.5 },
      { date: "2024-01-04", valueCad: 30.5 },
    ]);
  });

  it("never back-fills a close before its first observation", () => {
    expect(
      valueSeries(
        [{ date: "2024-01-01", units: { ABC: 1 } }],
        {
          ABC: {
            currency: "CAD",
            points: [{ date: "2024-01-02", close: 10 }],
          },
        },
        []
      )
    ).toEqual([]);
  });

  it("omits a date rather than silently dropping an unpriced holding", () => {
    expect(
      valueSeries(
        [{ date: "2024-01-01", units: { PRICED: 1, MISSING: 1 } }],
        {
          PRICED: {
            currency: "CAD",
            points: [{ date: "2024-01-01", close: 10 }],
          },
        },
        []
      )
    ).toEqual([]);
  });

  it("rejects unsupported security currencies", () => {
    expect(() =>
      valueSeries(
        [{ date: "2024-01-01", units: { EURF: 1 } }],
        {
          EURF: {
            currency: "EUR",
            points: [{ date: "2024-01-01", close: 10 }],
          },
        },
        []
      )
    ).toThrow("Unsupported price currency");
  });

  it("adds the reconstructed cash balance to securities NAV", () => {
    expect(
      addCashToValueSeries(
        [
          { date: "2024-01-01", valueCad: 90 },
          { date: "2024-01-02", valueCad: 105 },
        ],
        [
          { date: "2024-01-01", cashCad: 10 },
          { date: "2024-01-02", cashCad: -5 },
        ]
      )
    ).toEqual([
      { date: "2024-01-01", valueCad: 100 },
      { date: "2024-01-02", valueCad: 100 },
    ]);
  });
});

describe("externalFlows", () => {
  it("uses EFT only, reverses the app cash sign, aggregates dates, and retains net-zero dates", () => {
    const flows = externalFlows([
      entry({
        tradeDate: "2024-01-01",
        activityType: "MoneyMovement",
        activitySubType: "EFT",
        cashAmount: -100,
      }),
      entry({
        tradeDate: "2024-01-01",
        activityType: "MoneyMovement",
        activitySubType: "EFT",
        cashAmount: 25,
      }),
      entry({
        tradeDate: "2024-01-02",
        activityType: "MoneyMovement",
        activitySubType: "EFT",
        cashAmount: -50,
      }),
      entry({
        tradeDate: "2024-01-02",
        activityType: "MoneyMovement",
        activitySubType: "EFT",
        cashAmount: 50,
      }),
      entry({
        tradeDate: "2024-01-03",
        activityType: "MoneyMovement",
        activitySubType: "TRANSFER_TF",
        cashAmount: -500,
      }),
      entry({
        tradeDate: "2024-01-03",
        activityType: "Dividend",
        cashAmount: -10,
      }),
    ]);

    expect(flows).toEqual([
      { date: "2024-01-01", amountCad: 75 },
      { date: "2024-01-02", amountCad: 0 },
    ]);
  });
});

describe("twr", () => {
  it("includes a same-day inception contribution under the start-of-day convention", () => {
    expect(
      twr(
        [
          { date: "2024-01-01", valueCad: 105 },
          { date: "2024-01-02", valueCad: 115.5 },
        ],
        [{ date: "2024-01-01", amountCad: 100 }],
        "ALL"
      )
    ).toBeCloseTo(0.155, 12);
  });

  it("chain-links daily returns under the start-of-day flow convention", () => {
    const result = twr(
      [
        { date: "2024-01-01", valueCad: 100 },
        { date: "2024-01-02", valueCad: 110 },
        { date: "2024-01-03", valueCad: 176 },
      ],
      [{ date: "2024-01-03", amountCad: 50 }],
      "ALL"
    );

    expect(result).toBeCloseTo(0.21, 12);
  });

  it("uses the last valuation on the exact calendar boundary", () => {
    const values = dailyValues("2024-03-29", "2024-06-30", (date) => {
      if (date === "2024-03-29") return 80;
      if (date === "2024-03-30") return 100;
      return 110;
    });

    expect(twr(values, [], "3M")).toBeCloseTo(0.1, 12);
  });

  it("clamps calendar windows across leap days", () => {
    const values = dailyValues("2024-02-27", "2025-02-28", (date) =>
      date <= "2024-02-28" ? 100 : 120
    );

    expect(twr(values, [], "1Y")).toBeCloseTo(0.2, 12);
  });

  it("returns null for a missing valuation gap", () => {
    expect(
      twr(
        [
          { date: "2024-01-01", valueCad: 100 },
          { date: "2024-01-03", valueCad: 110 },
        ],
        [],
        "ALL"
      )
    ).toBeNull();
  });

  it("returns null when a flow falls outside the available all-time valuations", () => {
    expect(
      twr(
        [
          { date: "2024-01-02", valueCad: 100 },
          { date: "2024-01-03", valueCad: 110 },
        ],
        [{ date: "2024-01-01", amountCad: 100 }],
        "ALL"
      )
    ).toBeNull();
  });

  it("returns null when the daily denominator is non-positive", () => {
    expect(
      twr(
        [
          { date: "2024-01-01", valueCad: 100 },
          { date: "2024-01-02", valueCad: 10 },
        ],
        [{ date: "2024-01-02", amountCad: -100 }],
        "ALL"
      )
    ).toBeNull();
  });

  it("computes ALL from total NAV including reconstructed cash", () => {
    const ledger = [
      entry({
        tradeDate: "2024-01-01",
        activityType: "MoneyMovement",
        activitySubType: "EFT",
        cashAmount: -100,
      }),
      entry({
        tradeDate: "2024-01-02",
        activityType: "Trade",
        activitySubType: "BUY",
        symbolNorm: "ABC",
        units: 1,
        cashAmount: 100,
      }),
    ];
    const holdings = reconstructDailyHoldings(ledger, "2024-01-03");
    const securities = valueSeries(
      holdings,
      {
        ABC: {
          currency: "CAD",
          points: [
            { date: "2024-01-02", close: 100 },
            { date: "2024-01-03", close: 110 },
          ],
        },
      },
      []
    );
    const totalValues = addCashToValueSeries(
      securities,
      reconstructDailyCash(ledger, "2024-01-03")
    );

    expect(twr(totalValues, externalFlows(ledger), "ALL")).toBeCloseTo(0.1, 12);
  });
});

describe("mwr", () => {
  it("solves a known one-year XIRR and verifies its NPV", () => {
    const flows = [{ date: "2023-01-01", amountCad: 1000 }];
    const result = mwr(flows, 1100, "2024-01-01");

    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.1, 10);
    expect(mwrNpv(flows, 1100, "2024-01-01", result!)).toBeCloseTo(0, 7);
  });

  it("treats portfolio withdrawals as positive investor cash flows", () => {
    const result = mwr(
      [
        { date: "2023-01-01", amountCad: 1000 },
        { date: "2023-07-02", amountCad: -100 },
      ],
      1000,
      "2024-01-01"
    );

    expect(result).not.toBeNull();
    expect(mwrNpv([], 0, "2024-01-01", 0)).toBe(0);
    expect(mwrNpv([{ date: "2023-07-02", amountCad: -100 }], 0, "2024-01-01", 0)).toBe(100);
  });

  it("returns null when no sign-changing root exists", () => {
    expect(mwr([{ date: "2023-01-01", amountCad: 1000 }], 0, "2024-01-01")).toBeNull();
  });

  it("returns null rather than choosing between multiple valid IRRs", () => {
    expect(
      mwr(
        [
          { date: "2020-01-01", amountCad: 100 },
          { date: "2020-12-31", amountCad: -230 },
          { date: "2021-12-31", amountCad: 132 },
        ],
        0,
        "2021-12-31"
      )
    ).toBeNull();
  });
});
