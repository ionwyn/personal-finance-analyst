"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Network } from "lucide-react";

import { fetchCompany } from "@/components/features/supply-chain/api";
import { RelationshipList } from "@/components/features/supply-chain/relationship-list";
import { RelationshipMap } from "@/components/features/supply-chain/relationship-map";
import { Note, SpendConfirm } from "@/components/features/supply-chain/sc-primitives";
import styles from "@/components/features/supply-chain/splc.module.scss";
import { publishUsage } from "@/components/features/supply-chain/usage-bus";
import type { ValafiCompanyBundle, ValafiUsageSnapshot } from "@/lib/valafi/types";

// Position-page Supply Chain section. Peeks the cache on mount (never spends);
// shows the map inline if it's already cached, otherwise offers an explicit
// load (auto-confirm near cap) or a deep-link into the centralised hub.
export function PositionSupplyChain({ symbol, name }: { symbol: string; name?: string | null }) {
  const router = useRouter();
  const [bundle, setBundle] = useState<ValafiCompanyBundle | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [usage, setUsage] = useState<ValafiUsageSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const explorerHref = `/app/supply-chain/explorer?ticker=${encodeURIComponent(symbol)}`;
  const goExplore = (t: string) =>
    router.push(`/app/supply-chain/explorer?ticker=${encodeURIComponent(t)}` as never);

  const meaningful = (b: ValafiCompanyBundle | null): boolean => {
    if (!b) return false;
    return Boolean(b.profile || b.suppliers.length || b.customers.length || b.competitors.length);
  };

  useEffect(() => {
    let alive = true;
    fetchCompany(symbol, { peek: true })
      .then((res) => {
        if (!alive) return;
        if (meaningful(res.data)) {
          setBundle(res.data);
          setStatus(res.status);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [symbol]);

  const load = async (confirm = false) => {
    setBusy(true);
    setNeedsConfirm(false);
    try {
      const res = await fetchCompany(symbol, { confirm });
      publishUsage(res.usage);
      setUsage(res.usage);
      setStatus(res.status);
      if (res.needsConfirm) setNeedsConfirm(true);
      else if (res.data) setBundle(res.data);
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  if (meaningful(bundle) && bundle) {
    return (
      <div className="pos-stack">
        <div className="panel">
          <div className="panel-body flush">
            <RelationshipMap
              center={{
                ticker: bundle.ticker,
                name: bundle.profile?.name ?? name,
                sector: bundle.profile?.sector,
              }}
              suppliers={bundle.suppliers}
              customers={bundle.customers}
              competitors={bundle.competitors}
              onSelect={goExplore}
            />
          </div>
        </div>
        <div className="panel">
          <div className="panel-body">
            <RelationshipList
              center={bundle.ticker}
              suppliers={bundle.suppliers}
              customers={bundle.customers}
              competitors={bundle.competitors}
              onSelect={goExplore}
            />
          </div>
        </div>
        <Link href={explorerHref as never} className={styles.launchChip}>
          Open full explorer
          <ArrowUpRight size={11} />
        </Link>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-body">
        <div className={styles.enableCard}>
          <Network size={20} className={styles.enableIcon} />
          <p className={styles.enableCopy}>
            Map <strong>{symbol}</strong>&apos;s suppliers, customers and competitors extracted from
            SEC filings. Loading here uses one of your daily company lookups.
          </p>
          {needsConfirm && usage ? (
            <SpendConfirm usage={usage} onConfirm={() => load(true)} busy={busy} />
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={styles.enableBtn}
                onClick={() => load(false)}
                disabled={busy}
              >
                {busy ? "Loading…" : "Load supply chain"}
              </button>
              <Link href={explorerHref as never} className={styles.pickerBtn}>
                Open in Supply Chain
                <ArrowUpRight size={11} />
              </Link>
            </div>
          )}
          {status === "empty" ? (
            <Note tone="warn">No supply-chain data found for {symbol}.</Note>
          ) : null}
          {status === "disabled" ? <Note>Set VALAFI_API_KEY to enable.</Note> : null}
          {status === "blocked" && !needsConfirm ? (
            <Note tone="warn">Daily company limit reached — try the hub tomorrow.</Note>
          ) : null}
        </div>
      </div>
    </div>
  );
}
