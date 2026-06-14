import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
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
      <MarketsView data={data} />
    </AppShell>
  );
}
