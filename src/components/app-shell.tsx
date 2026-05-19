import { Sidebar, type SidebarUser } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

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
    <div className="app">
      <Sidebar mode={mode} user={user} />
      <main className="main">
        <Topbar mode={mode} dbSize={topbarMeta?.dbSize} />
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
