import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { MonitorView } from "@/components/features/monitor/monitor-view";
import { getDeskMonitor } from "@/lib/investments/monitor-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  const data = await getDeskMonitor(tenantId);

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
      <MonitorView data={data} />
    </AppShell>
  );
}
