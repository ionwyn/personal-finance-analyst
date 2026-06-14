"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Command, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useMounted } from "@/lib/use-mounted";
import styles from "./app-shell.module.scss";

const ROUTE_LABELS: Record<string, [string, string]> = {
  "/app": ["Workspace", "Dashboard"],
  "/app/accounts": ["Workspace", "Accounts"],
  "/app/transactions": ["Workspace", "Transactions"],
  "/app/portfolio": ["Workspace", "Portfolio"],
  "/app/markets": ["Workspace", "Markets"],
  "/app/settings": ["Workspace", "Settings"],
  "/demo": ["Public", "Demo (read-only)"],
};

function labelsFor(pathname: string): [string, string] {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  for (const key of Object.keys(ROUTE_LABELS).sort((a, b) => b.length - a.length)) {
    if (pathname.startsWith(key + "/")) return ROUTE_LABELS[key];
  }
  return ["Workspace", "Dashboard"];
}

export function Topbar({ mode, dbSize }: { mode: "private" | "demo"; dbSize?: string }) {
  const pathname = usePathname() ?? "/";
  const [time, setTime] = useState<string>("");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const tz = Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone.split("/")
        .pop()
        ?.slice(0, 3)
        .toUpperCase();
      setTime(
        `${d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })} ${tz ?? ""}`
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const [section, page] = labelsFor(pathname);

  return (
    <header className={styles.topbar}>
      <div className={styles.crumbs}>
        <span>{section}</span>
        <span className={styles.crumbsSep}>/</span>
        <span className={styles.crumbsCur}>{page}</span>
      </div>
      <div className={styles.topbarSpacer} />
      <div className={styles.topbarStatus}>
        <span className={styles.live}>
          <i className={styles.liveDot} />
          API · {mode === "demo" ? "SANDBOX" : "OK"}
        </span>
        {dbSize ? <span>DB · {dbSize}</span> : null}
        {time ? <span>{time}</span> : null}
      </div>
      {mounted ? (
        <button
          className={styles.topbarBtn}
          type="button"
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
        </button>
      ) : (
        <button className={styles.topbarBtn} type="button" aria-label="Toggle theme" disabled>
          <Sun size={13} />
        </button>
      )}
      <button className={styles.topbarBtn} type="button" aria-label="Command palette">
        <Command size={11} />K
      </button>
    </header>
  );
}
