import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { ContributionView } from "@/components/features/investments/contribution-view";
import { getPortfolioContributionData } from "@/lib/investments/analytics";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ContributionPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);
  const contributions = await getPortfolioContributionData(tenantId);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <ContributionView contributions={contributions} />
    </SessionAppShell>
  );
}
