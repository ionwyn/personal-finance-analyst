import Link from "next/link";

type TabKey = "overview" | "intel" | "insiders";

const TABS: { key: TabKey; href: string; label: string }[] = [
  { key: "overview", href: "/app/markets", label: "Overview" },
  { key: "intel", href: "/app/markets/intel", label: "Watch & Intel" },
  { key: "insiders", href: "/app/markets/insiders", label: "Insiders" },
];

export function MarketsTabs({ active }: { active: TabKey }) {
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
