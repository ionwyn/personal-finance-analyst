import type { ReactNode } from "react";

import { SessionAppShell } from "@/components/layout/session-app-shell";
import { getSessionTenant } from "@/lib/session";

// The shell (sidebar + topbar) lives here so it stays mounted across navigation
// within /app — only the page content swaps, letting each route's `loading.tsx`
// stream a skeleton into the content area while the slow query resolves.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { session, isDemo } = await getSessionTenant();

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      {children}
    </SessionAppShell>
  );
}
