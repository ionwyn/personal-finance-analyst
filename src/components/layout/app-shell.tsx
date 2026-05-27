import { Sidebar, type SidebarUser } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav, MobileTopbar } from "@/components/layout/mobile-nav";

import styles from "./app-shell.module.scss";

export type AppShellMode = "private" | "demo";

export function AppShell({
  children,
  mode,
  user,
  topbarMeta,
}: {
  children: React.ReactNode;
  mode: AppShellMode;
  user?: SidebarUser;
  topbarMeta?: { dbSize?: string };
}) {
  return (
    <div className={styles.app}>
      <Sidebar mode={mode} user={user} />
      <main className={styles.main}>
        <Topbar mode={mode} dbSize={topbarMeta?.dbSize} />
        <MobileTopbar mode={mode} />
        <MobileNav mode={mode} />
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
