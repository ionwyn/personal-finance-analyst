import { OverviewView } from "@/components/features/supply-chain/overview-view";
import { toPickHoldings } from "@/components/features/supply-chain/holdings";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import { getSessionTenant } from "@/lib/session";
import { getRegisteredPortfolioId } from "@/lib/valafi/portfolio";

export const dynamic = "force-dynamic";

export default async function SupplyChainOverviewPage() {
  const { tenantId } = await getSessionTenant();
  const [data, portfolioId] = await Promise.all([
    getInvestmentDashboardData(tenantId),
    tenantId ? getRegisteredPortfolioId(tenantId) : Promise.resolve(null),
  ]);

  return <OverviewView registered={portfolioId != null} holdings={toPickHoldings(data)} />;
}
