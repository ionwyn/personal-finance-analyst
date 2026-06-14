"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import clsx from "clsx";
import {
  ArrowLeftRight,
  CalendarClock,
  CandlestickChart,
  LayoutGrid,
  LogOut,
  Moon,
  PieChart,
  Settings,
  Sun,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { useMounted } from "@/lib/use-mounted";
import styles from "./app-shell.module.scss";

type MobileNavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const ICON = 18;

const PRIMARY: MobileNavItem[] = [
  { key: "dashboard", label: "Home", href: "/app?home=1", icon: <LayoutGrid size={ICON} /> },
  { key: "accounts", label: "Accounts", href: "/app/accounts", icon: <Wallet size={ICON} /> },
  {
    key: "transactions",
    label: "Tx",
    href: "/app/transactions",
    icon: <ArrowLeftRight size={ICON} />,
  },
  {
    key: "spending-insight",
    label: "Insight",
    href: "/app/spending-insight",
    icon: <PieChart size={ICON} />,
  },
  {
    key: "portfolio",
    label: "Folio",
    href: "/app/portfolio",
    icon: <TrendingUp size={ICON} />,
  },
  {
    key: "markets",
    label: "Mkts",
    href: "/app/markets",
    icon: <CandlestickChart size={ICON} />,
  },
  { key: "cycles", label: "Pay", href: "/app/cycles", icon: <CalendarClock size={ICON} /> },
  { key: "budgets", label: "Budgets", href: "/app/budgets", icon: <Target size={ICON} /> },
];

const ROUTE_TITLES: Array<[string, string]> = [
  ["/app/accounts", "Accounts"],
  ["/app/transactions", "Transactions"],
  ["/app/spending-insight", "Insight"],
  ["/app/portfolio", "Portfolio"],
  ["/app/markets", "Markets"],
  ["/app/cycles", "Pay Cycle"],
  ["/app/budgets", "Budgets"],
  ["/app/settings", "Settings"],
  ["/demo", "Demo"],
  ["/app", "Overview"],
];

function titleFor(pathname: string): string {
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return title;
  }
  return "Overview";
}

function isActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/app") return pathname === "/app";
  return pathname === path || pathname.startsWith(path + "/");
}

export function MobileTopbar({ mode }: { mode: "private" | "demo" }) {
  const pathname = usePathname() ?? "/";
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const title = titleFor(pathname);

  return (
    <header className={styles.mTopbar}>
      <div className={styles.mBrand}>
        <div className={styles.mBrandMark}>WYN</div>
        <div className={styles.mTitle}>{title}</div>
      </div>
      <span className={styles.mStatus} title={mode === "demo" ? "Sandbox · read-only" : "API OK"}>
        <span className={styles.mStatusDot} />
        <span className={styles.mStatusTxt}>{mode === "demo" ? "DEMO" : "OK"}</span>
      </span>
      {mounted ? (
        <button
          className={styles.mIconBtn}
          type="button"
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      ) : (
        <button className={styles.mIconBtn} type="button" aria-label="Toggle theme" disabled>
          <Sun size={14} />
        </button>
      )}
    </header>
  );
}

export function MobileNav({ mode }: { mode: "private" | "demo" }) {
  const pathname = usePathname() ?? "/";

  const items: MobileNavItem[] =
    mode === "private"
      ? [
          ...PRIMARY,
          {
            key: "settings",
            label: "Settings",
            href: "/app/settings",
            icon: <Settings size={ICON} />,
          },
        ]
      : [
          ...PRIMARY,
          { key: "signin", label: "Sign in", href: "/signin", icon: <LogOut size={ICON} /> },
        ];

  return (
    <nav className={styles.mTabs} aria-label="Primary">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href as never}
          className={clsx(styles.mTab, isActive(pathname, item.href) && styles.on)}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
        >
          <span className={styles.mTabIc}>{item.icon}</span>
          <span className={styles.mTabLbl}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
