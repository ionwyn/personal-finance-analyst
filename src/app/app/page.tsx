import { getServerSession } from "next-auth";

import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/analytics";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const session = await getServerSession(authOptions);
  const { tenantSlug, isDemo } = await resolveSessionTenant(session);
  const data = await getDashboardData(tenantSlug);

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
      <DashboardView data={data} mode={isDemo ? "demo" : "private"} />
    </AppShell>
  );
}
