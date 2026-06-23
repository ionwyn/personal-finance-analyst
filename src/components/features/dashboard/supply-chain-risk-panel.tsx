"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Network } from "lucide-react";

import {
  fetchAlerts,
  fetchExposure,
  fetchPortfolioStatus,
} from "@/components/features/supply-chain/api";
import { RiskBadge } from "@/components/features/supply-chain/sc-primitives";
import scStyles from "@/components/features/supply-chain/splc.module.scss";
import type { ValafiPortfolioExposure } from "@/lib/valafi/types";

type State = "loading" | "unregistered" | "disabled" | "ready" | "error";

// Compact dashboard teaser. Reads the (cached) portfolio endpoints; the real
// workspace lives at /app/supply-chain.
export function SupplyChainRiskPanel() {
  const [state, setState] = useState<State>("loading");
  const [exposure, setExposure] = useState<ValafiPortfolioExposure | null>(null);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const status = await fetchPortfolioStatus();
        if (!alive) return;
        if (status.usage.source === "disabled") return setState("disabled");
        if (!status.registered) return setState("unregistered");
        const [exp, al] = await Promise.all([fetchExposure(), fetchAlerts()]);
        if (!alive) return;
        setExposure(exp.data);
        setAlertCount(Array.isArray(al.data) ? al.data.length : 0);
        setState("ready");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const shared = exposure?.shared_suppliers ?? [];
  const risks = exposure?.concentration_warnings ?? [];
  const topRisk = risks[0];

  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--info)",
              display: "inline-block",
            }}
          />
          <div className="panel-title">Supply Chain Risk</div>
        </div>
        <Link
          href={"/app/supply-chain" as never}
          className="panel-meta"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-2)" }}
        >
          {state === "ready" ? "View all" : "Open"}
          <ChevronRight size={12} />
        </Link>
      </div>
      <div className="panel-body">
        {state === "loading" ? (
          <div style={{ padding: 8, fontSize: 12, color: "var(--text-4)" }}>Loading…</div>
        ) : null}

        {state === "disabled" || state === "error" ? (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            {state === "disabled"
              ? "Set VALAFI_API_KEY to surface supply-chain risk."
              : "Supply-chain data unavailable right now."}
          </div>
        ) : null}

        {state === "unregistered" ? (
          <Link
            href={"/app/supply-chain" as never}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <Network size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
              Map shared suppliers &amp; concentration risk across your holdings →
            </span>
          </Link>
        ) : null}

        {state === "ready" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                {shared.length} shared supplier{shared.length === 1 ? "" : "s"}
              </span>
              <div className={scStyles.compChips}>
                {shared.slice(0, 4).map((s) => (
                  <span key={s.supplier.ticker} className={scStyles.sharedByChip}>
                    {s.supplier.ticker}
                  </span>
                ))}
              </div>
            </div>

            {topRisk ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
                >
                  {topRisk.supplier.ticker} · {topRisk.affected_holdings.length} exposed
                </span>
                <RiskBadge level={topRisk.severity} />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-4)" }}>
                No single-source risks flagged
              </span>
            )}

            <div style={{ fontSize: 11, color: alertCount ? "var(--warn)" : "var(--text-4)" }}>
              {alertCount} active alert{alertCount === 1 ? "" : "s"}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
