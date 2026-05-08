import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/analytics";
import { DEMO_TENANT_SLUG } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const data = await getDashboardData(DEMO_TENANT_SLUG);
  return (
    <AppShell mode="demo">
      <DashboardView data={data} mode="demo" />
    </AppShell>
  );
}
