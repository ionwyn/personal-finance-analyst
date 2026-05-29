"use client";

import Link from "next/link";

type TabKey = "holdings" | "activity";

export function InvestmentsTabs({ active }: { active: TabKey }) {
  return (
    <div className="invest-tabs" role="tablist">
      <Link
        href="/app/investments"
        role="tab"
        aria-selected={active === "holdings"}
        className={"invest-tab " + (active === "holdings" ? "on" : "")}
      >
        Holdings
      </Link>
      <Link
        href="/app/investments/activity"
        role="tab"
        aria-selected={active === "activity"}
        className={"invest-tab " + (active === "activity" ? "on" : "")}
      >
        Activity
      </Link>
    </div>
  );
}
