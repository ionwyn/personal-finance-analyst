import { describe, expect, it } from "vitest";

import { findDuplicatePlaidAccountIds, isInvestmentAccountType } from "@/lib/analytics/duplicates";

describe("isInvestmentAccountType", () => {
  it("treats investment/brokerage/retirement accounts as investments", () => {
    expect(isInvestmentAccountType("investment", "brokerage")).toBe(true);
    expect(isInvestmentAccountType("investment", "non-taxable brokerage account")).toBe(true);
    expect(isInvestmentAccountType("brokerage", null)).toBe(true);
    expect(isInvestmentAccountType("investment", "retirement")).toBe(true);
  });

  it("does not treat banking accounts as investments", () => {
    expect(isInvestmentAccountType("depository", "checking")).toBe(false);
    expect(isInvestmentAccountType("credit", "credit card")).toBe(false);
    expect(isInvestmentAccountType("loan", "student")).toBe(false);
  });
});

describe("findDuplicatePlaidAccountIds", () => {
  const items = [
    {
      institutionName: "Wealthsimple",
      accounts: [
        { id: "cash", type: "depository", subtype: "chequing" },
        { id: "card", type: "credit", subtype: "credit card" },
        { id: "tfsa", type: "investment", subtype: "tfsa" },
      ],
    },
  ];

  it("flags investment accounts at an institution also connected via SnapTrade", () => {
    // SnapTrade reports the brokerage name slightly differently; matching is fuzzy.
    const dupes = findDuplicatePlaidAccountIds(items, ["Wealthsimple Trade"]);
    expect(dupes.has("tfsa")).toBe(true);
    expect(dupes.has("cash")).toBe(false);
    expect(dupes.has("card")).toBe(false);
  });

  it("does not flag anything when there are no SnapTrade connections", () => {
    expect(findDuplicatePlaidAccountIds(items, []).size).toBe(0);
    expect(findDuplicatePlaidAccountIds(items, [null, undefined]).size).toBe(0);
  });

  it("does not flag investment accounts at an unrelated institution", () => {
    const dupes = findDuplicatePlaidAccountIds(items, ["Questrade"]);
    expect(dupes.size).toBe(0);
  });
});
