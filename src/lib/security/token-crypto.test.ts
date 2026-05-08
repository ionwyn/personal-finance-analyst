import { describe, expect, it, vi } from "vitest";

import { decryptToken, encryptToken } from "@/lib/security/token-crypto";

describe("token encryption", () => {
  it("round trips access tokens without returning plaintext", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));

    const encrypted = encryptToken("access-sandbox-token");

    expect(encrypted).not.toContain("access-sandbox-token");
    expect(decryptToken(encrypted)).toBe("access-sandbox-token");
  });
});
