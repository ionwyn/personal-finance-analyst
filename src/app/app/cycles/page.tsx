import { CycleView } from "@/components/features/cycles/cycle-view";
import { getCurrentCycleData } from "@/lib/cycles/getCurrentCycle";
import { getRecurringCandidates } from "@/lib/cycles/recurring-candidates";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CyclesPage() {
  const { tenantId } = await getSessionTenant();

  if (!tenantId) {
    return (
      <section className="empty-state">
        <h2>No tenant found</h2>
      </section>
    );
  }

  const [data, discoveryCandidates] = await Promise.all([
    getCurrentCycleData(tenantId),
    getRecurringCandidates(tenantId),
  ]);

  return (
    <>
      {data ? (
        <CycleView data={data} discoveryCandidates={discoveryCandidates} />
      ) : (
        <section className="empty-state">
          <h2>No active cycle</h2>
          <p>Set your last paycheck date in Settings to start tracking pay cycles.</p>
        </section>
      )}

      <div className="foot-note">
        <span>
          Safe-to-sweep is computed in real time. Pending charges, recurring accruals, and credit
          card balance (when due this cycle) are reserved conservatively.
        </span>
        <span>⌘1 dashboard · settings ⚙</span>
      </div>
    </>
  );
}
