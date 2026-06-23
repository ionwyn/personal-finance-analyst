import { PathView } from "@/components/features/supply-chain/path-view";
import { toPickHoldings } from "@/components/features/supply-chain/holdings";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SupplyChainPathPage() {
  const { tenantId } = await getSessionTenant();
  const data = await getInvestmentDashboardData(tenantId);

  return <PathView holdings={toPickHoldings(data)} />;
}
