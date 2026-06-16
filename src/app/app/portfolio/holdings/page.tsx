import { HoldingsView } from "@/components/features/investments/holdings-view";
import { getPortfolioHoldingsData } from "@/lib/investments/analytics";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const { tenantId } = await getSessionTenant();
  const data = await getPortfolioHoldingsData(tenantId);

  return <HoldingsView data={data} />;
}
