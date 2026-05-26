import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { BudgetsView } from "@/components/features/budgets/budgets-view";
import { authOptions } from "@/lib/auth";
import { getBudgetGoalData } from "@/lib/budgets/getBudgetGoalData";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
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

  const data = await getBudgetGoalData(tenantId);

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
      <BudgetsView data={data} />
    </AppShell>
  );
}
