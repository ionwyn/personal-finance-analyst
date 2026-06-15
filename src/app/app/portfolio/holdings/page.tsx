import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { HoldingsView } from "@/components/features/investments/holdings-view";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);
  const data = await getInvestmentDashboardData(tenantId);

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
      <HoldingsView data={data} />
    </AppShell>
  );
}
