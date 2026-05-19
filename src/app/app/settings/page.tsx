import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/settings-view";
import { authOptions } from "@/lib/auth";
import { getSettingsData } from "@/lib/cycles/getSettings";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const tenant = await getUserTenant(session.user.id);
  if (!tenant) redirect("/signin");

  const data = await getSettingsData(tenant.id);

  return (
    <AppShell
      mode="private"
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        handle: session.user.email ?? undefined,
      }}
    >
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">
            PAY CYCLE · CATEGORIES · RULES · RECURRING · SAVINGS · SETTLEMENTS
          </div>
        </div>
      </div>

      <SettingsView data={data} />

      <div className="foot-note">
        <span>
          Changes to rules or patterns automatically reclassify existing transactions (manual
          overrides preserved).
        </span>
        <span>⌘1 dashboard · ⌘5 demo</span>
      </div>
    </AppShell>
  );
}
