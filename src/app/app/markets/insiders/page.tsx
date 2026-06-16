import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { InsiderTapeView } from "@/components/features/monitor/insider-tape-view";
import { getInsiderTape } from "@/lib/investments/insider-tape-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function InsidersPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  const data = await getInsiderTape(tenantId);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <InsiderTapeView data={data} />
    </SessionAppShell>
  );
}
