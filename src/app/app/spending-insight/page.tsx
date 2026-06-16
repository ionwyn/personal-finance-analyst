import { SpendingInsightView } from "@/components/features/spending-insight/spending-insight-view";
import { getSpendingInsight } from "@/lib/spending/getSpendingInsight";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SpendingInsightPage() {
  const { tenantId } = await getSessionTenant();

  if (!tenantId) {
    return (
      <section className="empty-state">
        <h2>No tenant found</h2>
      </section>
    );
  }

  const [mtd, ytd] = await Promise.all([
    getSpendingInsight(tenantId, "MTD"),
    getSpendingInsight(tenantId, "YTD"),
  ]);

  return <SpendingInsightView mtd={mtd} ytd={ytd} />;
}
