import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { SessionAppShell } from "@/components/layout/session-app-shell";
import { CycleView } from "@/components/features/cycles/cycle-view";
import { authOptions } from "@/lib/auth";
import { getCurrentCycleData } from "@/lib/cycles/getCurrentCycle";
import { discoverRecurringCandidates } from "@/lib/cycles/discovery";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CyclesPage() {
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

  const [data, discoveryCandidates] = await Promise.all([
    getCurrentCycleData(tenantId),
    discoverRecurringCandidates(tenantId),
  ]);

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
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
    </SessionAppShell>
  );
}
