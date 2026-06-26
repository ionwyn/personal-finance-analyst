import { describe, expect, it } from "vitest";

import { sanitizeRemoteAssistantText } from "./remote-sanitize";

describe("sanitizeRemoteAssistantText", () => {
  it("redacts direct identifiers while preserving finance figures", () => {
    const input = [
      "Email ionwyn@example.com and call 604-555-1234.",
      "account id: acc_1234567890",
      "Card ending in 1234 spent CAD 1,234.56 at SHOP.",
      "Transaction ref 123456789012345.",
    ].join("\n");

    const output = sanitizeRemoteAssistantText(input);

    expect(output).toContain("[email redacted]");
    expect(output).toContain("[phone redacted]");
    expect(output).toContain("account id: [redacted]");
    expect(output).toContain("Card [redacted] spent CAD 1,234.56");
    expect(output).toContain("Transaction ref [number redacted].");
  });
});
