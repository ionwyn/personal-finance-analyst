"use client";

import Link from "next/link";

type TabKey = "holdings" | "activity" | "analytics" | "markets" | "monitor";

const TABS: { key: TabKey; href: string; label: string }[] = [
  { key: "holdings", href: "/app/investments", label: "Holdings" },
  { key: "activity", href: "/app/investments/activity", label: "Activity" },
  { key: "analytics", href: "/app/investments/analytics", label: "Analytics" },
  { key: "markets", href: "/app/investments/markets", label: "Markets" },
  { key: "monitor", href: "/app/investments/monitor", label: "Monitor" },
];

export function InvestmentsTabs({ active }: { active: TabKey }) {
  return (
    <div className="invest-tabs" role="tablist">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href as never}
          role="tab"
          aria-selected={active === t.key}
          className={"invest-tab " + (active === t.key ? "on" : "")}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
