import { ContributionView } from "@/components/features/investments/contribution-view";
import { getPortfolioContributionData } from "@/lib/investments/analytics";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ContributionPage() {
  const { tenantId } = await getSessionTenant();
  const contributions = await getPortfolioContributionData(tenantId);

  return <ContributionView contributions={contributions} />;
}
