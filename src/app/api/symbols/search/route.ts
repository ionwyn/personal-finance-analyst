import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { getMarketDataService } from "@/lib/market-data";

// Typeahead symbol search (Yahoo). Auth-gated so this is not an open proxy.
export async function GET(request: Request) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = await getMarketDataService()
    .searchSymbols(q, 8)
    .catch(() => []);

  // Keep only tradeable security types the app understands.
  const allowed = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX", "CRYPTOCURRENCY"]);
  return NextResponse.json({
    results: results.filter((r) => !r.type || allowed.has(r.type.toUpperCase())),
  });
}
