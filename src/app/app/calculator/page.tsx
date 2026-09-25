import { CalculatorView } from "@/components/features/calculator/calculator-view";
import { getCalculatorData } from "@/lib/calculator/getCalculatorData";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const { tenantId } = await getSessionTenant();

  if (!tenantId) {
    return (
      <section className="empty-state">
        <h2>No tenant found</h2>
      </section>
    );
  }

  return <CalculatorView data={await getCalculatorData(tenantId)} />;
}
