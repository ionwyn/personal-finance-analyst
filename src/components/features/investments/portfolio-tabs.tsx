"use client";

import Link from "next/link";

type TabKey = "overview" | "holdings" | "contribution" | "activity" | "performance";

const TABS: { key: TabKey; href: string; label: string }[] = [
  { key: "overview", href: "/app/portfolio", label: "Overview" },
  { key: "holdings", href: "/app/portfolio/holdings", label: "Holdings" },
  { key: "contribution", href: "/app/portfolio/contribution", label: "Contribution" },
  { key: "activity", href: "/app/portfolio/activity", label: "Activity" },
  { key: "performance", href: "/app/portfolio/performance", label: "Performance" },
];

export function PortfolioTabs({ active }: { active: TabKey }) {
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
