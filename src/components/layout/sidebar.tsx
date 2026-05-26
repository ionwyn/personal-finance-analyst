"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
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

import styles from "./app-shell.module.scss";

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
            href: "/app?home=1",
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
            href: "/app?home=1",
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
      "1": "/app?home=1",
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

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>WYN</div>
        <div className={styles.brandName}>WYN Financial Ltd.</div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>Workspace</div>
        {primary.map((item) => (
          <Link
            key={item.key}
            className={clsx(styles.navItem, isActive(item.href) && styles.active)}
            href={item.href as never}
          >
            <span className={styles.navIcon} style={{ width: ICON_SIZE, height: ICON_SIZE }}>
              {item.icon}
            </span>
            {item.label}
            {item.kbd ? <span className={styles.navKbd}>{item.kbd}</span> : null}
          </Link>
        ))}

        <div className={styles.navSection}>{mode === "private" ? "Other" : "Auth"}</div>
        {secondary.map((item) => (
          <Link
            key={item.key}
            className={clsx(styles.navItem, isActive(item.href) && styles.active)}
            href={item.href as never}
          >
            <span className={styles.navIcon} style={{ width: ICON_SIZE, height: ICON_SIZE }}>
              {item.icon}
            </span>
            {item.label}
            {item.kbd ? <span className={styles.navKbd}>{item.kbd}</span> : null}
          </Link>
        ))}
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
