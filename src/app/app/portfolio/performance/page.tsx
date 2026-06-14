import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { AnalyticsView } from "@/components/features/analytics/analytics-view";
import { getPortfolioAnalytics } from "@/lib/investments/analytics-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  const data = await getPortfolioAnalytics(tenantId);

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
      <AnalyticsView data={data} />
    </AppShell>
  );
}
