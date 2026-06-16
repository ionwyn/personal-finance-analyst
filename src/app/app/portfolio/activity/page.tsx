import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { ActivityView } from "@/components/features/investments/activity-view";
import { loadActivities } from "@/lib/investments/activities-loader";
import { loadInvestmentConnectionSummary } from "@/lib/investments/loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  const [activities, investmentConnections] = await Promise.all([
    loadActivities(tenantId),
    loadInvestmentConnectionSummary(tenantId),
  ]);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <ActivityView
        rows={activities.rows}
        totalRowCount={activities.totalRowCount}
        cappedAt={activities.cappedAt}
        accountOptions={activities.accountOptions}
        connections={investmentConnections.connections}
        lastSyncAt={investmentConnections.lastSyncAt}
      />
    </SessionAppShell>
  );
}
