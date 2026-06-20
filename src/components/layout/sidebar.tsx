"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarDays,
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  PieChart,
  Settings,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import styles from "./app-shell.module.scss";

const COLLAPSED_KEY = "sidebar-collapsed";
const COLLAPSED_W = "48px";

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

type NavSection = {
  label: string;
  items: NavItem[];
};

export function Sidebar({ mode, user }: { mode: "private" | "demo"; user?: SidebarUser }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(COLLAPSED_KEY) === "1"
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? COLLAPSED_W : "");
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const overview: NavItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      href: "/app?home=1",
      icon: <LayoutGrid size={ICON_SIZE} />,
      kbd: "⌘1",
    },
  ];

  const banking: NavItem[] = [
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
      key: "cycles",
      label: "Pay Cycles",
      href: "/app/cycles",
      icon: <CalendarClock size={ICON_SIZE} />,
      kbd: "⌘5",
    },
    {
      key: "budgets",
      label: "Budgets & Goals",
      href: "/app/budgets",
      icon: <Target size={ICON_SIZE} />,
      kbd: "⌘6",
    },
  ];

  const investing: NavItem[] = [
    {
      key: "portfolio",
      label: "Portfolio",
      href: "/app/portfolio",
      icon: <TrendingUp size={ICON_SIZE} />,
      kbd: "⌘7",
    },
    {
      key: "markets",
      label: "Markets",
      href: "/app/markets",
      icon: <CandlestickChart size={ICON_SIZE} />,
      kbd: "⌘8",
    },
  ];

  // Workspace — cross-cutting tools shared by banking and investing.
  const workspace: NavItem[] = [
    {
      key: "calendar",
      label: "Calendar",
      href: "/app/calendar",
      icon: <CalendarDays size={ICON_SIZE} />,
      kbd: "⌘9",
    },
  ];

  const sections: NavSection[] = [
    { label: "Overview", items: overview },
    { label: "Banking", items: banking },
    { label: "Investing", items: investing },
    { label: "Workspace", items: workspace },
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
      "1": "/app?home=1",
      "2": "/app/accounts",
      "3": "/app/transactions",
      "4": "/app/spending-insight",
      "5": "/app/portfolio",
      "6": "/app/markets",
      "7": "/app/cycles",
      "8": "/app/budgets",
      "9": "/app/calendar",
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
    const path = href.split("?")[0];
    if (path === "/app") return pathname === "/app";
    return pathname === path || pathname.startsWith(path + "/");
  };

  const initials =
    (user?.name ?? user?.email ?? "")
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "—";

  const renderItem = (item: NavItem) => (
    <Link
      key={item.key}
      className={clsx(styles.navItem, isActive(item.href) && styles.active)}
      href={item.href as never}
      title={item.label}
    >
      <span className={styles.navIcon}>{item.icon}</span>
      <span className={styles.navLabel}>{item.label}</span>
      {item.kbd ? <span className={styles.navKbd}>{item.kbd}</span> : null}
    </Link>
  );

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>WYN</div>
        <div className={styles.brandName}>WYN Financial Ltd.</div>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((c) => !c)}
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      <nav className={styles.nav}>
        {sections.map((section, i) => (
          <div key={section.label}>
            {i === 2 && <div className={styles.navDivider} />}
            <div className={styles.navSection}>{section.label}</div>
            {section.items.map(renderItem)}
          </div>
        ))}

        <div className={styles.navSpacer} />

        <div className={styles.navSection}>{mode === "private" ? "Other" : "Auth"}</div>
        {secondary.map(renderItem)}
      </nav>

      {mode === "private" && user ? (
        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className={styles.userMeta}>
            <div className={styles.userName}>{user.name ?? "User"}</div>
            <div className={styles.userHandle}>{user.handle ?? user.email ?? ""}</div>
          </div>
          <button
            className={styles.signout}
            onClick={() => signOut({ callbackUrl: "/signin" })}
            type="button"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={12} />
          </button>
        </div>
      ) : (
        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>DM</div>
          <div className={styles.userMeta}>
            <div className={styles.userName}>Demo viewer</div>
            <div className={styles.userHandle}>read-only</div>
          </div>
        </div>
      )}
    </aside>
  );
}
