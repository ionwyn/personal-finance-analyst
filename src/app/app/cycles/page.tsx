import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppShell } from "@/components/app-shell";
import { CycleView } from "@/components/cycle-view";
import { authOptions } from "@/lib/auth";
import { getCurrentCycleData } from "@/lib/cycles/getCurrentCycle";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CyclesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const tenant = await getUserTenant(session.user.id);
  if (!tenant) redirect("/signin");

  const data = await getCurrentCycleData(tenant.id);

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
      {data ? (
        <CycleView data={data} />
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
    </AppShell>
  );
}
