import { Sidebar, type SidebarUser } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

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
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
