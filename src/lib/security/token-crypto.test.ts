import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  decryptToken,
  encryptToken,
  getActiveTokenEncryptionKeyId,
  getEncryptedTokenKeyId,
} from "@/lib/security/token-crypto";

const legacyKey = Buffer.alloc(32, 7).toString("base64");
const newKey = Buffer.alloc(32, 8).toString("base64");

describe("token encryption", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("round trips legacy access tokens without returning plaintext", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", legacyKey);

    const encrypted = encryptToken("access-sandbox-token");

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("access-sandbox-token");
    expect(getEncryptedTokenKeyId(encrypted)).toBeNull();
    expect(getActiveTokenEncryptionKeyId()).toBeNull();
    expect(decryptToken(encrypted)).toBe("access-sandbox-token");
  });

  it("round trips keyed access tokens with the active key id", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEYS", JSON.stringify({ "2026-06": newKey }));
    vi.stubEnv("TOKEN_ENCRYPTION_ACTIVE_KID", "2026-06");

    const encrypted = encryptToken("access-sandbox-token");

    expect(encrypted).toMatch(/^v2:2026-06:/);
    expect(encrypted).not.toContain("access-sandbox-token");
    expect(getEncryptedTokenKeyId(encrypted)).toBe("2026-06");
    expect(getActiveTokenEncryptionKeyId()).toBe("2026-06");
    expect(decryptToken(encrypted)).toBe("access-sandbox-token");
  });

  it("decrypts legacy payloads with a configured legacy key id", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", legacyKey);
    const encrypted = encryptToken("access-sandbox-token");

    vi.unstubAllEnvs();
    vi.stubEnv("TOKEN_ENCRYPTION_KEYS", JSON.stringify({ old: legacyKey, "2026-06": newKey }));
    vi.stubEnv("TOKEN_ENCRYPTION_ACTIVE_KID", "2026-06");
    vi.stubEnv("TOKEN_ENCRYPTION_LEGACY_KID", "old");

    expect(decryptToken(encrypted)).toBe("access-sandbox-token");
  });

  it("fails closed when a keyed payload key id is unavailable", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEYS", JSON.stringify({ "2026-06": newKey }));
    vi.stubEnv("TOKEN_ENCRYPTION_ACTIVE_KID", "2026-06");
    const encrypted = encryptToken("access-sandbox-token");

    vi.stubEnv("TOKEN_ENCRYPTION_KEYS", JSON.stringify({ "2026-07": legacyKey }));
    vi.stubEnv("TOKEN_ENCRYPTION_ACTIVE_KID", "2026-07");

    expect(() => decryptToken(encrypted)).toThrow(/No token encryption key configured/);
  });

  it("rejects key ids that cannot be encoded safely", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEYS", JSON.stringify({ "bad:kid": newKey }));
    vi.stubEnv("TOKEN_ENCRYPTION_ACTIVE_KID", "bad:kid");

    expect(() => encryptToken("access-sandbox-token")).toThrow(/cannot contain ':'/);
  });
});
