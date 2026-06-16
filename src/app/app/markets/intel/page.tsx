import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { MonitorView } from "@/components/features/monitor/monitor-view";
import { getWatchlist } from "@/lib/investments/markets-loader";
import { getDeskMonitor } from "@/lib/investments/monitor-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function IntelPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  const [data, watchlist] = await Promise.all([getDeskMonitor(tenantId), getWatchlist(tenantId)]);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <MonitorView data={data} watchlist={watchlist} canEdit={!isDemo} />
    </SessionAppShell>
  );
}
