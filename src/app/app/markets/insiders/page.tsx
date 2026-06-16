import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
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
      <InsiderTapeView data={data} />
    </AppShell>
  );
}
