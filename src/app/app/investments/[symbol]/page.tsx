import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PositionView } from "@/components/features/positions/position-view";
import { getPositionDetail } from "@/lib/investments/position-loader";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PositionPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);
  const data = await getPositionDetail(tenantId, symbol);

  if (!data) notFound();

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
      <PositionView data={data} />
    </AppShell>
  );
}
