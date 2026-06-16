import { InvestmentsView } from "@/components/features/investments/investments-view";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import { getPortfolioPulse } from "@/lib/investments/markets-loader";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { tenantId } = await getSessionTenant();
  const [data, pulse] = await Promise.all([
    getInvestmentDashboardData(tenantId),
    getPortfolioPulse(tenantId),
  ]);

  return <InvestmentsView data={data} pulse={pulse} />;
}
