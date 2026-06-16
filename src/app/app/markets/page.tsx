import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { MarketsView } from "@/components/features/markets/markets-view";
import { getMacroBoard } from "@/lib/investments/markets-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const session = await getServerSession(authOptions);
  const { isDemo } = await resolveSessionTenant(session);

  const data = await getMacroBoard();

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <MarketsView data={data} />
    </SessionAppShell>
  );
}
