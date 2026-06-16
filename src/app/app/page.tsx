import { redirect } from "next/navigation";

import { DashboardView } from "@/components/features/dashboard/dashboard-view";
import { getDashboardData } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { getSessionTenant } from "@/lib/session";
import { landingPath } from "@/lib/settings/landing";

export const dynamic = "force-dynamic";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ home?: string }>;
}) {
  const { session, tenantSlug, isDemo } = await getSessionTenant();

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

  return <DashboardView data={data} mode={isDemo ? "demo" : "private"} />;
}
