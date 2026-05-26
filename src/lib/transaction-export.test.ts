import { describe, expect, it } from "vitest";

import { transactionRowsToCsv, type TransactionExportRow } from "@/lib/transaction-export";

describe("transaction CSV export", () => {
  it("always emits a verbose header row when there are no matching transactions", () => {
    const csv = transactionRowsToCsv([]);

    expect(csv).toContain("plaid_transaction_id");
    expect(csv).toContain("spending_bucket");
    expect(csv).toContain("raw_json");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("quotes CSV content and neutralizes spreadsheet formulas in text values", () => {
    const row = {
      name: 'Cafe, "North"\nMarket',
      merchant_name: '=HYPERLINK("https://example.test")',
      amount: -24.5,
      pending: false,
      raw_json: '{"note":"verbose"}',
    } as TransactionExportRow;

    const csv = transactionRowsToCsv([row]);

    expect(csv).toContain('"Cafe, ""North""\nMarket"');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(csv).toContain(",-24.5,");
    expect(csv).toContain('"{""note"":""verbose""}"');
  });
});
