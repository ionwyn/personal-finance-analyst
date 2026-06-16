import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { HoldingsView } from "@/components/features/investments/holdings-view";
import { getPortfolioHoldingsData } from "@/lib/investments/analytics";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);
  const data = await getPortfolioHoldingsData(tenantId);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <HoldingsView data={data} />
    </SessionAppShell>
  );
}
