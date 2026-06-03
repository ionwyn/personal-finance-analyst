import { describe, expect, it } from "vitest";

import { rateLimitRequest } from "@/lib/rate-limit";

function requestFrom(ip: string) {
  return new Request("https://example.test/api/thing", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimitRequest", () => {
  it("allows requests up to the limit, then blocks with 429", () => {
    const ip = "10.0.0.1";
    const opts = { keyPrefix: "test:basic", limit: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i += 1) {
      expect(rateLimitRequest(requestFrom(ip), opts)).toBeNull();
    }

    const blocked = rateLimitRequest(requestFrom(ip), opts);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();
    expect(blocked!.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("tracks distinct clients independently", () => {
    const opts = { keyPrefix: "test:isolation", limit: 1, windowMs: 60_000 };

    expect(rateLimitRequest(requestFrom("10.0.0.2"), opts)).toBeNull();
    // Different IP starts its own bucket and is still allowed.
    expect(rateLimitRequest(requestFrom("10.0.0.3"), opts)).toBeNull();
    // First IP has exhausted its single slot.
    expect(rateLimitRequest(requestFrom("10.0.0.2"), opts)).not.toBeNull();
  });

  it("keeps separate counters per keyPrefix", () => {
    const ip = "10.0.0.4";
    expect(
      rateLimitRequest(requestFrom(ip), { keyPrefix: "test:a", limit: 1, windowMs: 60_000 })
    ).toBeNull();
    // Same client, different prefix → independent allowance.
    expect(
      rateLimitRequest(requestFrom(ip), { keyPrefix: "test:b", limit: 1, windowMs: 60_000 })
    ).toBeNull();
  });
});
