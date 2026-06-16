import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
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
    <SessionAppShell session={session} isDemo={isDemo}>
      <AnalyticsView data={data} />
    </SessionAppShell>
  );
}
