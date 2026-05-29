import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { ActivityView } from "@/components/features/investments/activity-view";
import { loadActivities } from "@/lib/investments/activities-loader";
import { loadInvestments } from "@/lib/investments/loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  const [activities, investments] = await Promise.all([
    loadActivities(tenantId),
    loadInvestments(tenantId),
  ]);

  const lastSyncAt = investments.connections.reduce<string | null>((acc, c) => {
    if (!c.lastSyncAt) return acc;
    if (!acc) return c.lastSyncAt;
    return c.lastSyncAt > acc ? c.lastSyncAt : acc;
  }, null);

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
        connections={investments.connections}
        lastSyncAt={lastSyncAt}
      />
    </AppShell>
  );
}
