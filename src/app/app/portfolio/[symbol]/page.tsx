import { notFound } from "next/navigation";

import { PositionView } from "@/components/features/positions/position-view";
import { SymbolView } from "@/components/features/symbols/symbol-view";
import { getPositionDetail } from "@/lib/investments/position-loader";
import { getSymbolDetail } from "@/lib/investments/symbol-loader";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PositionPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const { tenantId, isDemo } = await getSessionTenant();
  const data = await getPositionDetail(tenantId, symbol);

  // Not held anywhere → market-only research view (watchlist & searches).
  const symbolData = data ? null : await getSymbolDetail(tenantId, symbol);
  if (!data && !symbolData) notFound();

  return data ? <PositionView data={data} /> : <SymbolView data={symbolData!} canEdit={!isDemo} />;
}
