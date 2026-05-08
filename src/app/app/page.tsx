import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/analytics";
import { authOptions } from "@/lib/auth";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const tenant = await getUserTenant(session.user.id);
  const data = await getDashboardData(tenant?.slug ?? "personal");

  return (
    <AppShell
      mode="private"
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        handle: session.user.email ?? undefined
      }}
    >
      <DashboardView data={data} mode="private" />
    </AppShell>
  );
}
