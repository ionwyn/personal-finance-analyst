import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { requireEnv } from "@/lib/env";

const LEGACY_VERSION = "v1";
const KEYED_VERSION = "v2";

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function parseKey(secret: string, envName: string): Buffer {
  const base64 = Buffer.from(secret, "base64");
  if (base64.length === 32) return base64;

  const hex = Buffer.from(secret, "hex");
  if (hex.length === 32) return hex;

  const utf8 = Buffer.from(secret, "utf8");
  if (utf8.length === 32) return utf8;

  throw new Error(`${envName} must decode to 32 bytes. Run \`npm run secrets\` to generate one.`);
}

function getLegacyKey(): Buffer {
  return parseKey(requireEnv("TOKEN_ENCRYPTION_KEY"), "TOKEN_ENCRYPTION_KEY");
}

function getKeyring(): Map<string, Buffer> {
  const raw = process.env.TOKEN_ENCRYPTION_KEYS;
  if (!raw) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TOKEN_ENCRYPTION_KEYS must be a JSON object of key id to 32-byte key.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("TOKEN_ENCRYPTION_KEYS must be a JSON object of key id to 32-byte key.");
  }

  const keyring = new Map<string, Buffer>();
  for (const [kid, secret] of Object.entries(parsed)) {
    if (!kid.trim()) throw new Error("TOKEN_ENCRYPTION_KEYS cannot contain an empty key id.");
    if (kid.includes(":")) {
      throw new Error("TOKEN_ENCRYPTION_KEYS key ids cannot contain ':'.");
    }
    if (typeof secret !== "string") {
      throw new Error(`TOKEN_ENCRYPTION_KEYS.${kid} must be a string.`);
    }
    keyring.set(kid, parseKey(secret, `TOKEN_ENCRYPTION_KEYS.${kid}`));
  }

  if (keyring.size === 0) {
    throw new Error("TOKEN_ENCRYPTION_KEYS must contain at least one key.");
  }

  return keyring;
}

function getActiveKey(): { kid?: string; key: Buffer } {
  const keyring = getKeyring();
  if (keyring.size === 0) return { key: getLegacyKey() };

  const kid = requireEnv("TOKEN_ENCRYPTION_ACTIVE_KID");
  const key = keyring.get(kid);
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_ACTIVE_KID must match a key in TOKEN_ENCRYPTION_KEYS.");
  }

  return { kid, key };
}

function getKeyForKid(kid: string): Buffer {
  const key = getKeyring().get(kid);
  if (!key) throw new Error(`No token encryption key configured for key id: ${kid}`);
  return key;
}

function getKeyForLegacyPayload(): Buffer {
  const keyring = getKeyring();
  if (keyring.size === 0) return getLegacyKey();

  const legacyKid = process.env.TOKEN_ENCRYPTION_LEGACY_KID;
  if (!legacyKid) return getLegacyKey();

  const key = keyring.get(legacyKid);
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_LEGACY_KID must match a key in TOKEN_ENCRYPTION_KEYS.");
  }

  return key;
}

export function encryptToken(token: string): string {
  const active = getActiveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", active.key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  if (active.kid) {
    return [KEYED_VERSION, active.kid, encode(iv), encode(tag), encode(ciphertext)].join(":");
  }

  return [LEGACY_VERSION, encode(iv), encode(tag), encode(ciphertext)].join(":");
}

export function decryptToken(payload: string): string {
  const parts = payload.split(":");
  const [version] = parts;

  if (version === LEGACY_VERSION) {
    const [, iv, tag, ciphertext] = parts;
    if (!iv || !tag || !ciphertext || parts.length !== 4) {
      throw new Error("Unsupported encrypted token format.");
    }

    const decipher = createDecipheriv("aes-256-gcm", getKeyForLegacyPayload(), decode(iv));
    decipher.setAuthTag(decode(tag));
    return Buffer.concat([decipher.update(decode(ciphertext)), decipher.final()]).toString("utf8");
  }

  if (version === KEYED_VERSION) {
    const [, kid, iv, tag, ciphertext] = parts;
    if (!kid || !iv || !tag || !ciphertext || parts.length !== 5) {
      throw new Error("Unsupported encrypted token format.");
    }

    const decipher = createDecipheriv("aes-256-gcm", getKeyForKid(kid), decode(iv));
    decipher.setAuthTag(decode(tag));
    return Buffer.concat([decipher.update(decode(ciphertext)), decipher.final()]).toString("utf8");
  }

  throw new Error("Unsupported encrypted token format.");
}

export function getEncryptedTokenKeyId(payload: string): string | null {
  const [version, kid] = payload.split(":");
  if (version === LEGACY_VERSION) return null;
  if (version === KEYED_VERSION && kid) return kid;
  throw new Error("Unsupported encrypted token format.");
}

export function getActiveTokenEncryptionKeyId(): string | null {
  const keyring = getKeyring();
  if (keyring.size === 0) {
    getLegacyKey();
    return null;
  }

  const kid = requireEnv("TOKEN_ENCRYPTION_ACTIVE_KID");
  if (!keyring.has(kid)) {
    throw new Error("TOKEN_ENCRYPTION_ACTIVE_KID must match a key in TOKEN_ENCRYPTION_KEYS.");
  }

  return kid;
}

export function assertTokenCanDecrypt(payload: string): void {
  decryptToken(payload);
}

export function assertTokenCanEncrypt(): void {
  encryptToken("token-encryption-self-test");
}

export function assertTokenCanReEncrypt(payload: string): void {
  const plaintext = decryptToken(payload);
  const encrypted = encryptToken(plaintext);
  if (decryptToken(encrypted) !== plaintext) {
    throw new Error("Unsupported encrypted token format.");
  }
}
