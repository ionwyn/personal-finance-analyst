import { redirect } from "next/navigation";

import {
  SettingsShell,
  type SectionId,
  type SettingsConnections,
} from "@/components/features/settings/settings-shell";
import { getDashboardData } from "@/lib/analytics";
import { getSettingsData } from "@/lib/cycles/getSettings";
import { getSession } from "@/lib/session";
import { getSyncRuns } from "@/lib/settings/getSyncRuns";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const SECTION_IDS: SectionId[] = [
  "pay-cycle",
  "categories",
  "connections",
  "budgets",
  "display",
  "data",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");

  const tenant = await getUserTenant(session.user.id);
  if (!tenant) redirect("/signin");

  const [data, dashboard, syncRuns] = await Promise.all([
    getSettingsData(tenant.id),
    getDashboardData(tenant.slug),
    getSyncRuns(tenant.id),
  ]);

  const investAccounts = dashboard.investments.accounts;
  const connectionIds = [...new Set(investAccounts.map((a) => a.connectionId))];
  const hasSnaptrade = dashboard.investments.summary.connectionCount > 0;

  const connections: SettingsConnections = {
    items: dashboard.institutions.map((i) => ({
      id: i.id,
      name: i.institutionName,
      status: i.status,
      lastSyncAt: i.lastSyncAt,
      errorCode: i.errorCode,
      accountCount: i.accounts.length,
    })),
    snaptrade: hasSnaptrade
      ? {
          institution: dashboard.investments.summary.institution,
          status: dashboard.investments.summary.status,
          lastSync: dashboard.investments.summary.lastSync,
          accountCount: investAccounts.length,
          connectionId: connectionIds.length === 1 ? connectionIds[0] : null,
        }
      : null,
    hasSnaptrade,
  };

  const sp = await searchParams;
  const initialSection: SectionId = SECTION_IDS.includes(sp.s as SectionId)
    ? (sp.s as SectionId)
    : "pay-cycle";

  return (
    <>
      <SettingsShell
        data={data}
        syncRuns={syncRuns}
        connections={connections}
        webhookPath="/api/webhooks/plaid"
        tenantLabel={tenant.slug}
        isDemo={false}
        initialSection={initialSection}
      />

      <div className="foot-note">
        <span>
          Changes to rules or patterns automatically reclassify existing transactions (manual
          overrides preserved).
        </span>
        <span>⌘1 dashboard</span>
      </div>
    </>
  );
}
