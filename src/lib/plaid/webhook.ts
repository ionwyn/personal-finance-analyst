import { createHash, timingSafeEqual } from "node:crypto";

import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";

import { getPlaidClient } from "@/lib/plaid/client";

const keyCache = new Map<string, JWK>();

export async function verifyPlaidWebhook(rawBody: string, signedJwt: string | null) {
  const explicitOptOut = process.env.PLAID_VERIFY_WEBHOOKS === "false";

  if (explicitOptOut) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PLAID_VERIFY_WEBHOOKS=false is not allowed in production. Configure webhook signing in the Plaid dashboard."
      );
    }
    return true;
  }

  if (!signedJwt) return false;

  const header = decodeProtectedHeader(signedJwt);
  if (header.alg !== "ES256" || !header.kid) return false;

  let jwk = keyCache.get(header.kid);
  if (!jwk) {
    const response = await getPlaidClient().webhookVerificationKeyGet({
      key_id: header.kid
    });
    jwk = response.data.key as JWK;
    keyCache.set(header.kid, jwk);
  }

  const key = await importJWK(jwk, "ES256");
  const { payload } = await jwtVerify(signedJwt, key, {
    algorithms: ["ES256"]
  });

  const expectedHash = payload.request_body_sha256;
  if (typeof expectedHash !== "string") return false;

  const actualHash = createHash("sha256").update(rawBody).digest("hex");
  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(actualHash);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
