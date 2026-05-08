import { describe, expect, it } from "vitest";

import { isCronAuthorized } from "@/lib/cron";

describe("cron authorization", () => {
  it("rejects missing secrets", () => {
    expect(isCronAuthorized(new Headers({ authorization: "Bearer test" }), "")).toBe(false);
  });

  it("accepts bearer or x-cron-secret matches", () => {
    expect(isCronAuthorized(new Headers({ authorization: "Bearer test" }), "test")).toBe(true);
    expect(isCronAuthorized(new Headers({ "x-cron-secret": "test" }), "test")).toBe(true);
  });
});
