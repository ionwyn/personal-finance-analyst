import { MonitorView } from "@/components/features/monitor/monitor-view";
import { getWatchlist } from "@/lib/investments/markets-loader";
import { getDeskMonitor } from "@/lib/investments/monitor-loader";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function IntelPage() {
  const { tenantId, isDemo } = await getSessionTenant();

  const [data, watchlist] = await Promise.all([getDeskMonitor(tenantId), getWatchlist(tenantId)]);

  return <MonitorView data={data} watchlist={watchlist} canEdit={!isDemo} />;
}
