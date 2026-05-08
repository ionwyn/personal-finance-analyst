import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { requireEnv } from "@/lib/env";

const VERSION = "v1";

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function getKey(): Buffer {
  const secret = requireEnv("TOKEN_ENCRYPTION_KEY");
  const base64 = Buffer.from(secret, "base64");
  if (base64.length === 32) return base64;

  const hex = Buffer.from(secret, "hex");
  if (hex.length === 32) return hex;

  const utf8 = Buffer.from(secret, "utf8");
  if (utf8.length === 32) return utf8;

  throw new Error(
    "TOKEN_ENCRYPTION_KEY must decode to 32 bytes. Run `npm run secrets` to generate one."
  );
}

export function encryptToken(token: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, encode(iv), encode(tag), encode(ciphertext)].join(":");
}

export function decryptToken(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted token format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(), decode(iv));
  decipher.setAuthTag(decode(tag));
  return Buffer.concat([
    decipher.update(decode(ciphertext)),
    decipher.final()
  ]).toString("utf8");
}
