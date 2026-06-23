import { CompanyExplorer } from "@/components/features/supply-chain/company-explorer";
import { toPickHoldings } from "@/components/features/supply-chain/holdings";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SupplyChainExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const [{ tenantId }, sp] = await Promise.all([getSessionTenant(), searchParams]);
  const data = await getInvestmentDashboardData(tenantId);

  return <CompanyExplorer holdings={toPickHoldings(data)} initialTicker={sp.ticker} />;
}
