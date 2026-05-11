import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppShell } from "@/components/app-shell";
import { SpendingInsightView } from "@/components/spending-insight-view";
import { authOptions } from "@/lib/auth";
import { getSpendingInsight } from "@/lib/spending/getSpendingInsight";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function SpendingInsightPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const tenant = await getUserTenant(session.user.id);
  if (!tenant) redirect("/signin");

  const [mtd, ytd] = await Promise.all([
    getSpendingInsight(tenant.id, "MTD"),
    getSpendingInsight(tenant.id, "YTD")
  ]);

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
      <SpendingInsightView mtd={mtd} ytd={ytd} />
    </AppShell>
  );
}
