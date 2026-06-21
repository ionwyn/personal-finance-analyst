import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { getDeploymentMode } from "@/lib/env";
import { getSessionTenant } from "@/lib/session";

// The shell (sidebar + topbar) lives here so it stays mounted across navigation
// within /app — only the page content swaps, letting each route's `loading.tsx`
// stream a skeleton into the content area while the slow query resolves.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { session, isDemo } = await getSessionTenant();

  // On the private deployment, never render the app (or fall back to demo data)
  // for an anonymous visitor — send them to sign in. The demo deployment serves
  // the demo tenant to everyone, so it skips this gate.
  if (getDeploymentMode() === "private" && !session?.user) {
    redirect("/signin");
  }

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      {children}
    </SessionAppShell>
  );
}
