import { InsiderTapeView } from "@/components/features/monitor/insider-tape-view";
import { getInsiderTape } from "@/lib/investments/insider-tape-loader";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InsidersPage() {
  const { tenantId } = await getSessionTenant();

  const data = await getInsiderTape(tenantId);

  return <InsiderTapeView data={data} />;
}
