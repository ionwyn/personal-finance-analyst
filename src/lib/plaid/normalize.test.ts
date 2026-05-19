import { describe, expect, it } from "vitest";
import type { Transaction } from "plaid";

import { normalizeTransaction, summarizeTransactionChanges } from "@/lib/plaid/normalize";

describe("Plaid normalization", () => {
  it("normalizes transaction fields used by analytics", () => {
    const normalized = normalizeTransaction({
      account_id: "acct_1",
      amount: 42.25,
      iso_currency_code: "USD",
      unofficial_currency_code: null,
      date: "2026-05-08",
      location: {},
      name: "RAW COFFEE",
      merchant_name: "Coffee Shop",
      payment_meta: {},
      pending: false,
      pending_transaction_id: null,
      account_owner: null,
      transaction_id: "txn_1",
      authorized_date: "2026-05-07",
      authorized_datetime: null,
      datetime: null,
      payment_channel: "in store",
      transaction_code: null,
      personal_finance_category: {
        primary: "FOOD_AND_DRINK",
        detailed: "FOOD_AND_DRINK_COFFEE",
        confidence_level: "VERY_HIGH",
      },
    } as Transaction);

    expect(normalized.plaidTransactionId).toBe("txn_1");
    expect(normalized.categoryPrimary).toBe("FOOD_AND_DRINK");
    expect(normalized.date.toISOString()).toBe("2026-05-08T00:00:00.000Z");
    expect(normalized.amount.toNumber()).toBe(42.25);
  });

  it("summarizes incremental sync pages", () => {
    expect(
      summarizeTransactionChanges({
        added: [1, 2],
        modified: [3],
        removed: [4, 5, 6],
      })
    ).toEqual({
      addedCount: 2,
      modifiedCount: 1,
      removedCount: 3,
    });
  });
});
