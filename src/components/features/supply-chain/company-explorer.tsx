"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Panel } from "@/components/ui";
import type { ValafiCompanyBundle, ValafiUsageSnapshot } from "@/lib/valafi/types";

import { fetchCompany, type Envelope } from "./api";
import { CompanyExposure, hasExposure } from "./company-exposure";
import { normalizeInput } from "./input";
import { RelationshipList } from "./relationship-list";
import { RelationshipMap } from "./relationship-map";
import { ImpactSimulator } from "./impact-simulator";
import { Note, SpendConfirm } from "./sc-primitives";
import type { PickHolding } from "./types";
import { publishUsage } from "./usage-bus";
import styles from "./splc.module.scss";

export function CompanyExplorer({
  holdings,
  initialTicker,
}: {
  holdings: PickHolding[];
  initialTicker?: string;
}) {
  const [ticker, setTicker] = useState<string | null>(initialTicker?.toUpperCase() ?? null);
  const [query, setQuery] = useState("");
  const [bundle, setBundle] = useState<ValafiCompanyBundle | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [usage, setUsage] = useState<ValafiUsageSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (t: string, confirm = false) => {
    const id = ++reqId.current;
    setBusy(true);
    setNeedsConfirm(false);
    try {
      const res: Envelope<ValafiCompanyBundle> = await fetchCompany(t, { confirm });
      if (id !== reqId.current) return; // a newer request superseded this one
      publishUsage(res.usage);
      setUsage(res.usage);
      setStatus(res.status);
      setMessage(res.message);
      if (res.needsConfirm) {
        setNeedsConfirm(true);
        if (res.data) setBundle(res.data);
      } else {
        setBundle(res.data);
      }
    } catch {
      if (id === reqId.current) setStatus("error");
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }, []);

  const select = useCallback(
    (raw: string) => {
      const t = normalizeInput(raw);
      if (!t) return;
      setTicker(t);
      setBundle(null);
      window.history.replaceState(null, "", `/app/supply-chain/explorer?ticker=${t}`);
      void load(t);
    },
    [load]
  );

  useEffect(() => {
    if (!initialTicker) return;
    // Defer out of the synchronous effect body so the load's setState runs in a
    // microtask, not a cascading render.
    void Promise.resolve().then(() => load(initialTicker.toUpperCase()));
  }, [initialTicker, load]);

  const quickPicks = holdings.filter((h) => h.trackable).slice(0, 10);
  const hasData =
    bundle &&
    (bundle.profile ||
      bundle.suppliers.length ||
      bundle.customers.length ||
      bundle.competitors.length);

  return (
    <div className={styles.explorer}>
      <Panel
        title="Company Explorer"
        meta={ticker ? <span className="mono">{ticker}</span> : "pick a company"}
      >
        <form
          className={styles.picker}
          onSubmit={(e) => {
            e.preventDefault();
            select(query);
            setQuery("");
          }}
        >
          <Search size={14} className={styles.pickerIcon} />
          <input
            className={styles.pickerInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a US ticker (e.g. AAPL, NVDA, TSM)…"
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className={styles.pickerBtn} disabled={!query.trim()}>
            Map it
          </button>
        </form>

        {quickPicks.length > 0 ? (
          <div className={styles.quickPicks}>
            <span className={styles.quickLabel}>Your holdings</span>
            {quickPicks.map((h) => (
              <button
                key={h.symbol}
                type="button"
                className={`${styles.quickChip} ${ticker === h.symbol.toUpperCase() ? styles.quickOn : ""}`}
                onClick={() => select(h.symbol)}
                title={`${h.name} · ${h.weightPct.toFixed(1)}%`}
              >
                {h.symbol}
              </button>
            ))}
          </div>
        ) : null}
      </Panel>

      {!ticker ? (
        <Note>
          Pick one of your holdings or search any US-listed company to map its supply chain.
        </Note>
      ) : null}

      {ticker && busy && !bundle ? <div className={styles.loading}>Mapping {ticker}…</div> : null}

      {needsConfirm && usage ? (
        <SpendConfirm usage={usage} onConfirm={() => ticker && load(ticker, true)} busy={busy} />
      ) : null}

      {ticker && !busy && status === "empty" ? (
        <Note tone="warn">{message ?? `No supply-chain data found for ${ticker}.`}</Note>
      ) : null}
      {ticker && status === "disabled" ? (
        <Note>Set VALAFI_API_KEY to load live supply-chain data.</Note>
      ) : null}
      {ticker && status === "blocked" && !needsConfirm && !hasData ? (
        <Note tone="warn">Daily company limit reached — showing cached companies only.</Note>
      ) : null}

      {hasData && bundle ? (
        <>
          <Panel
            title={bundle.profile?.name ?? bundle.ticker}
            meta={
              <span className="mono">
                {[bundle.profile?.sector, bundle.profile?.industry, bundle.profile?.exchange]
                  .filter(Boolean)
                  .join(" · ") || bundle.ticker}
              </span>
            }
            flush
          >
            <RelationshipMap
              center={{
                ticker: bundle.ticker,
                name: bundle.profile?.name,
                sector: bundle.profile?.sector,
              }}
              suppliers={bundle.suppliers}
              customers={bundle.customers}
              competitors={bundle.competitors}
              onSelect={select}
            />
            {bundle.truncated ? (
              <div className={styles.truncNote}>
                Showing 5 per side
                {bundle.maxHopsAvailable ? ` · ${bundle.maxHopsAvailable} hops mapped on Pro` : ""}
              </div>
            ) : null}
          </Panel>

          {hasExposure(bundle.exposure) ? (
            <Panel title="Concentration & exposure" meta="single-source & shared dependencies">
              <CompanyExposure exposure={bundle.exposure!} onSelect={select} />
            </Panel>
          ) : null}

          <div className={styles.explorerGrid}>
            <Panel title="Relationships">
              <RelationshipList
                center={bundle.ticker}
                suppliers={bundle.suppliers}
                customers={bundle.customers}
                competitors={bundle.competitors}
                onSelect={select}
              />
            </Panel>
            <Panel title="Disruption simulator" meta="if this company is hit">
              <ImpactSimulator ticker={bundle.ticker} onSelect={select} />
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
