import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { PositionView } from "@/components/features/positions/position-view";
import { SymbolView } from "@/components/features/symbols/symbol-view";
import { getPositionDetail } from "@/lib/investments/position-loader";
import { getSymbolDetail } from "@/lib/investments/symbol-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PositionPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);
  const data = await getPositionDetail(tenantId, symbol);

  // Not held anywhere → market-only research view (watchlist & searches).
  const symbolData = data ? null : await getSymbolDetail(tenantId, symbol);
  if (!data && !symbolData) notFound();

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      {data ? <PositionView data={data} /> : <SymbolView data={symbolData!} canEdit={!isDemo} />}
    </SessionAppShell>
  );
}
