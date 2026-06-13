import { afterEach, describe, expect, it, vi } from "vitest";

import { requestApi } from "./client-api";

describe("requestApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns successful responses", async () => {
    const response = new Response(null, { status: 204 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(requestApi("/api/watchlist/AMD", { method: "DELETE" })).resolves.toBe(response);
  });

  it("throws the API error message for failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "Not on watchlist" }, { status: 404 }))
    );

    await expect(requestApi("/api/watchlist/AMD", { method: "DELETE" })).rejects.toThrow(
      "Not on watchlist"
    );
  });
});
