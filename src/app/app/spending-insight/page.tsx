import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { SessionAppShell } from "@/components/layout/session-app-shell";
import { SpendingInsightView } from "@/components/features/spending-insight/spending-insight-view";
import { authOptions } from "@/lib/auth";
import { getSpendingInsight } from "@/lib/spending/getSpendingInsight";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function SpendingInsightPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  if (!tenantId) {
    return (
      <AppShell mode={isDemo ? "demo" : "private"}>
        <section className="empty-state">
          <h2>No tenant found</h2>
        </section>
      </AppShell>
    );
  }

  const [mtd, ytd] = await Promise.all([
    getSpendingInsight(tenantId, "MTD"),
    getSpendingInsight(tenantId, "YTD"),
  ]);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <SpendingInsightView mtd={mtd} ytd={ytd} />
    </SessionAppShell>
  );
}
