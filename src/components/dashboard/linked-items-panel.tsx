import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StatusPill } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";

import type { DashboardData } from "./types";

export function LinkedItemsPanel({ data }: { data: DashboardData }) {
  if (!data.plaidItems.length) return null;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Linked items</div>
        <Link
          className="panel-meta"
          href="/app/accounts"
          style={{ color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}
        >
          Manage <ChevronRight size={12} />
        </Link>
      </div>
      <div className="panel-body flush">
        {data.plaidItems.slice(0, 4).map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "var(--text)", fontWeight: 500 }}>{item.institutionName}</div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-4)",
                  marginTop: 2,
                }}
              >
                {item.lastSyncAt ? formatRelativeTime(item.lastSyncAt) : "Never synced"}
              </div>
            </div>
            <StatusPill status={item.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
