import type { Session } from "next-auth";

import { AppShell, type AppShellMode } from "@/components/layout/app-shell";

/**
 * AppShell pre-wired from a NextAuth session. Demo tenants render without a
 * user (anonymous sidebar); private tenants surface the signed-in user. This
 * keeps the session→sidebar mapping in one place instead of being copy-pasted
 * across every protected page.
 */
export function SessionAppShell({
  session,
  isDemo,
  topbarMeta,
  children,
}: {
  session: Session | null;
  isDemo: boolean;
  topbarMeta?: { dbSize?: string };
  children: React.ReactNode;
}) {
  const mode: AppShellMode = isDemo ? "demo" : "private";
  return (
    <AppShell
      mode={mode}
      topbarMeta={topbarMeta}
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
      {children}
    </AppShell>
  );
}
