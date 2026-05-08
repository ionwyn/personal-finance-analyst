"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Command } from "lucide-react";

const ROUTE_LABELS: Record<string, [string, string]> = {
  "/app": ["Workspace", "Dashboard"],
  "/app/accounts": ["Workspace", "Accounts"],
  "/app/transactions": ["Workspace", "Transactions"],
  "/app/investments": ["Workspace", "Investments"],
  "/app/settings": ["Workspace", "Settings"],
  "/demo": ["Public", "Demo (read-only)"]
};

function labelsFor(pathname: string): [string, string] {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  for (const key of Object.keys(ROUTE_LABELS).sort((a, b) => b.length - a.length)) {
    if (pathname.startsWith(key + "/")) return ROUTE_LABELS[key];
  }
  return ["Workspace", "Dashboard"];
}

export function Topbar({
  mode,
  dbSize
}: {
  mode: "private" | "demo";
  dbSize?: string;
}) {
  const pathname = usePathname() ?? "/";
  const [time, setTime] = useState<string>("");

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
    <header className="topbar">
      <div className="crumbs">
        <span>{section}</span>
        <span className="sep">/</span>
        <span className="cur">{page}</span>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-status">
        <span className="live">
          <i className="dot" />
          API · {mode === "demo" ? "SANDBOX" : "OK"}
        </span>
        {dbSize ? <span>DB · {dbSize}</span> : null}
        {time ? <span>{time}</span> : null}
      </div>
      <button className="topbar-btn" type="button" aria-label="Command palette">
        <Command size={11} />
        K
      </button>
    </header>
  );
}
