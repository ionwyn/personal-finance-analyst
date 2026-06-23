"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./splc.module.scss";

const TABS: [string, string][] = [
  ["/app/supply-chain", "Overview"],
  ["/app/supply-chain/explorer", "Company Explorer"],
  ["/app/supply-chain/path", "Pathfinder"],
];

export function SubNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className={styles.subnav}>
      {TABS.map(([href, label]) => {
        const active = href === "/app/supply-chain" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href as never}
            className={`${styles.subnavLink} ${active ? styles.subnavOn : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
