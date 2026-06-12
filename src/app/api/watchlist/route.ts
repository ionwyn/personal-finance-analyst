import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { getMarketDataService } from "@/lib/market-data";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

const MAX_WATCHLIST_ITEMS = 50;

const bodySchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().max(200).nullable().optional(),
  exchange: z.string().max(60).nullable().optional(),
});

export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const symbol = parsed.data.symbol.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "Symbol required" }, { status: 400 });

  const count = await prisma.watchlistItem.count({ where: { tenantId: auth.tenant.id } });
  if (count >= MAX_WATCHLIST_ITEMS) {
    return NextResponse.json(
      { error: `Watchlist is capped at ${MAX_WATCHLIST_ITEMS} symbols` },
      { status: 400 }
    );
  }

  // Resolve the quote up front: validates the symbol exists and warms the cache.
  const quote = await getMarketDataService()
    .getQuote(symbol)
    .catch(() => null);
  if (!quote) {
    return NextResponse.json({ error: `No market data found for ${symbol}` }, { status: 404 });
  }

  const item = await prisma.watchlistItem.upsert({
    where: { tenantId_symbol: { tenantId: auth.tenant.id, symbol } },
    create: {
      tenantId: auth.tenant.id,
      symbol,
      name: parsed.data.name?.trim() || null,
      exchange: parsed.data.exchange?.trim() || null,
    },
    update: {},
  });

  return NextResponse.json({ item: { id: item.id, symbol: item.symbol, name: item.name } });
}
