import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
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
    <AppShell
      mode={isDemo ? "demo" : "private"}
      user={
        isDemo
          ? undefined
          : {
              name: session?.user?.name,
              email: session?.user?.email,
              image: session?.user?.image,
              handle: session?.user?.email ?? undefined,
            }
      }
    >
      <ActivityView
        rows={activities.rows}
        totalRowCount={activities.totalRowCount}
        cappedAt={activities.cappedAt}
        accountOptions={activities.accountOptions}
        connections={investmentConnections.connections}
        lastSyncAt={investmentConnections.lastSyncAt}
      />
    </AppShell>
  );
}
