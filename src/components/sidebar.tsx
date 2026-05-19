"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowLeftRight,
  CalendarClock,
  LayoutGrid,
  LogOut,
  PieChart,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";

export type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  handle?: string | null;
};

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  kbd?: string;
};

const ICON_SIZE = 14;

export function Sidebar({ mode, user }: { mode: "private" | "demo"; user?: SidebarUser }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const primary: NavItem[] =
    mode === "private"
      ? [
          {
            key: "dashboard",
            label: "Dashboard",
            href: "/app",
            icon: <LayoutGrid size={ICON_SIZE} />,
            kbd: "⌘1",
          },
          {
            key: "accounts",
            label: "Accounts",
            href: "/app/accounts",
            icon: <Wallet size={ICON_SIZE} />,
            kbd: "⌘2",
          },
          {
            key: "transactions",
            label: "Transactions",
            href: "/app/transactions",
            icon: <ArrowLeftRight size={ICON_SIZE} />,
            kbd: "⌘3",
          },
          {
            key: "spending-insight",
            label: "Spending Insight",
            href: "/app/spending-insight",
            icon: <PieChart size={ICON_SIZE} />,
            kbd: "⌘4",
          },
          {
            key: "investments",
            label: "Investments",
            href: "/app/investments",
            icon: <TrendingUp size={ICON_SIZE} />,
            kbd: "⌘5",
          },
          {
            key: "cycles",
            label: "Pay cycles",
            href: "/app/cycles",
            icon: <CalendarClock size={ICON_SIZE} />,
            kbd: "⌘6",
          },
        ]
      : [
          {
            key: "dashboard",
            label: "Dashboard",
            href: "/app",
            icon: <LayoutGrid size={ICON_SIZE} />,
            kbd: "⌘1",
          },
          {
            key: "accounts",
            label: "Accounts",
            href: "/app/accounts",
            icon: <Wallet size={ICON_SIZE} />,
            kbd: "⌘2",
          },
          {
            key: "transactions",
            label: "Transactions",
            href: "/app/transactions",
            icon: <ArrowLeftRight size={ICON_SIZE} />,
            kbd: "⌘3",
          },
          {
            key: "spending-insight",
            label: "Spending Insight",
            href: "/app/spending-insight",
            icon: <PieChart size={ICON_SIZE} />,
            kbd: "⌘4",
          },
          {
            key: "investments",
            label: "Investments",
            href: "/app/investments",
            icon: <TrendingUp size={ICON_SIZE} />,
            kbd: "⌘5",
          },
          {
            key: "cycles",
            label: "Pay cycles",
            href: "/app/cycles",
            icon: <CalendarClock size={ICON_SIZE} />,
            kbd: "⌘6",
          },
        ];

  const secondary: NavItem[] =
    mode === "private"
      ? [
          {
            key: "settings",
            label: "Settings",
            href: "/app/settings",
            icon: <Settings size={ICON_SIZE} />,
          },
        ]
      : [{ key: "signin", label: "Sign in", href: "/signin", icon: <LogOut size={ICON_SIZE} /> }];

  useEffect(() => {
    const map: Record<string, string> = {
      "1": "/app",
      "2": "/app/accounts",
      "3": "/app/transactions",
      "4": "/app/spending-insight",
      "5": "/app/investments",
      "6": "/app/cycles",
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = map[e.key];
      if (!target) return;
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement | null)?.tagName ?? "")) return;
      e.preventDefault();
      router.push(target as never);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, mode]);

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const initials =
    (user?.name ?? user?.email ?? "")
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "—";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">WYN</div>
        <div className="brand-name">WYN Financial Ltd.</div>
      </div>

      <nav className="nav">
        <div className="nav-section">Workspace</div>
        {primary.map((item) => (
          <Link
            key={item.key}
            className={`nav-item ${isActive(item.href) ? "active" : ""}`}
            href={item.href as never}
          >
            <span className="ic" style={{ width: ICON_SIZE, height: ICON_SIZE }}>
              {item.icon}
            </span>
            {item.label}
            {item.kbd ? <span className="kbd">{item.kbd}</span> : null}
          </Link>
        ))}

        <div className="nav-section">{mode === "private" ? "Other" : "Auth"}</div>
        {secondary.map((item) => (
          <Link
            key={item.key}
            className={`nav-item ${isActive(item.href) ? "active" : ""}`}
            href={item.href as never}
          >
            <span className="ic" style={{ width: ICON_SIZE, height: ICON_SIZE }}>
              {item.icon}
            </span>
            {item.label}
            {item.kbd ? <span className="kbd">{item.kbd}</span> : null}
          </Link>
        ))}
      </nav>

      {mode === "private" && user ? (
        <div className="sidebar-footer">
          <div className="avatar">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className="user-meta">
            <div className="user-name">{user.name ?? "User"}</div>
            <div className="user-handle">{user.handle ?? user.email ?? ""}</div>
          </div>
          <button
            className="signout"
            onClick={() => signOut({ callbackUrl: "/signin" })}
            type="button"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={12} />
          </button>
        </div>
      ) : (
        <div className="sidebar-footer">
          <div className="avatar">DM</div>
          <div className="user-meta">
            <div className="user-name">Demo viewer</div>
            <div className="user-handle">read-only</div>
          </div>
        </div>
      )}
    </aside>
  );
}
