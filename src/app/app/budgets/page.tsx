import { BudgetsView } from "@/components/features/budgets/budgets-view";
import { getBudgetGoalData } from "@/lib/budgets/getBudgetGoalData";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const { tenantId } = await getSessionTenant();

  if (!tenantId) {
    return (
      <section className="empty-state">
        <h2>No tenant found</h2>
      </section>
    );
  }

  const data = await getBudgetGoalData(tenantId);

  return <BudgetsView data={data} />;
}
