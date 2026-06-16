import { AnalyticsView } from "@/components/features/analytics/analytics-view";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

// Only the cheap tenant resolution is awaited here; the expensive portfolio
// analytics (TWR/MWR + external profiles) streams inside AnalyticsView's
// <Suspense> boundary so the header paints immediately.
export default async function PerformancePage() {
  const { tenantId } = await getSessionTenant();

  return <AnalyticsView tenantId={tenantId} />;
}
