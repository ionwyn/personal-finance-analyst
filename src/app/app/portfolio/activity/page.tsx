import { ActivityView } from "@/components/features/investments/activity-view";
import { loadActivities } from "@/lib/investments/activities-loader";
import { loadInvestmentConnectionSummary } from "@/lib/investments/loader";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { tenantId } = await getSessionTenant();

  const [activities, investmentConnections] = await Promise.all([
    loadActivities(tenantId),
    loadInvestmentConnectionSummary(tenantId),
  ]);

  return (
    <ActivityView
      rows={activities.rows}
      totalRowCount={activities.totalRowCount}
      cappedAt={activities.cappedAt}
      accountOptions={activities.accountOptions}
      connections={investmentConnections.connections}
      lastSyncAt={investmentConnections.lastSyncAt}
    />
  );
}
