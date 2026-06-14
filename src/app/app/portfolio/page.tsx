import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { InvestmentsView } from "@/components/features/investments/investments-view";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import { getPortfolioPulse } from "@/lib/investments/markets-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);
  const [data, pulse] = await Promise.all([
    getInvestmentDashboardData(tenantId),
    getPortfolioPulse(tenantId),
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
      <InvestmentsView data={data} pulse={pulse} />
    </AppShell>
  );
}
