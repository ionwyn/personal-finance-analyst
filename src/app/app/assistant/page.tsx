import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { AssistantView } from "@/components/features/assistant/assistant-view";
import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const session = await getServerSession(authOptions);
  const { isDemo } = await resolveSessionTenant(session);

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
      <AssistantView />
    </AppShell>
  );
}
