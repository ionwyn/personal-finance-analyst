import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { DashboardView } from "@/components/features/dashboard/dashboard-view";
import { getDashboardData } from "@/lib/analytics";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { landingPath } from "@/lib/settings/landing";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ home?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { tenantSlug, isDemo } = await resolveSessionTenant(session);

  // Honor the user's default landing page (Settings → Display). `?home=1`
  // (the sidebar Dashboard link) bypasses it so the dashboard stays reachable.
  const sp = await searchParams;
  if (!isDemo && session?.user?.id && sp.home !== "1") {
    const settings = await prisma.userSettings.findFirst({
      where: { tenant: { slug: tenantSlug } },
      select: { defaultLanding: true },
    });
    const target = landingPath(settings?.defaultLanding);
    if (target) redirect(target);
  }

  const data = await getDashboardData(tenantSlug);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <DashboardView data={data} mode={isDemo ? "demo" : "private"} />
    </SessionAppShell>
  );
}
