"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, ShieldAlert, Zap } from "lucide-react";

import { Panel } from "@/components/ui";
import type { ValafiPortfolioExposure, ValafiPortfolioSimulate } from "@/lib/valafi/types";

import { enablePortfolio, fetchExposure, simulate } from "./api";
import { impactColor, shortName } from "./format";
import { normalizeInput } from "./input";
import { Note, RiskBadge } from "./sc-primitives";
import { publishUsage } from "./usage-bus";
import styles from "./splc.module.scss";

const explorerHref = (t: string) => `/app/supply-chain/explorer?ticker=${encodeURIComponent(t)}`;

export function PortfolioExposurePanel({ registered: initialRegistered }: { registered: boolean }) {
  const [registered, setRegistered] = useState(initialRegistered);
  const [enabling, setEnabling] = useState(false);
  const [enableNote, setEnableNote] = useState<string | null>(null);
  const [exposure, setExposure] = useState<ValafiPortfolioExposure | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [simInput, setSimInput] = useState("");
  const [sim, setSim] = useState<ValafiPortfolioSimulate | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const loadExposure = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchExposure();
      publishUsage(res.usage);
      setStatus(res.status);
      setExposure(res.data);
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!registered) return;
    void Promise.resolve().then(() => loadExposure());
  }, [registered, loadExposure]);

  const enable = async () => {
    setEnabling(true);
    setEnableNote(null);
    try {
      const res = await enablePortfolio();
      publishUsage(res.usage);
      if (res.result.status === "fresh" || res.result.status === "cached") {
        setRegistered(true);
        setEnableNote(
          `Registered ${res.result.holdings.length} holdings · cost ${res.measured.requestDelta} request${
            res.measured.requestDelta === 1 ? "" : "s"
          }${res.measured.tickerDelta ? ` and ${res.measured.tickerDelta} company slots` : ""}.`
        );
      } else if (res.result.status === "empty") {
        setEnableNote("None of your holdings are US-listed issuers Vala-Fi tracks.");
      } else if (res.result.status === "blocked") {
        setEnableNote("Daily request budget reached — try again tomorrow.");
      } else if (res.result.status === "disabled") {
        setEnableNote("Set VALAFI_API_KEY to enable portfolio monitoring.");
      } else {
        setEnableNote("Registration failed — try again later.");
      }
    } catch {
      setEnableNote("Registration failed — try again later.");
    } finally {
      setEnabling(false);
    }
  };

  const runSim = async () => {
    const t = normalizeInput(simInput);
    if (!t) return;
    setSimBusy(true);
    try {
      const res = await simulate(t);
      publishUsage(res.usage);
      setSim(res.data);
    } catch {
      setSim(null);
    } finally {
      setSimBusy(false);
    }
  };

  if (!registered) {
    return (
      <Panel title="Portfolio supply-chain exposure" meta="not enabled">
        <div className={styles.enableCard}>
          <Boxes size={20} className={styles.enableIcon} />
          <p className={styles.enableCopy}>
            Register your top holdings with Vala-Fi to reveal <strong>shared suppliers</strong>,
            single-source <strong>concentration risk</strong> and a portfolio-wide exposure score.
            One-time setup — costs a single request.
          </p>
          <button type="button" className={styles.enableBtn} onClick={enable} disabled={enabling}>
            {enabling ? "Registering…" : "Enable monitoring"}
          </button>
          {enableNote ? <Note>{enableNote}</Note> : null}
        </div>
      </Panel>
    );
  }

  const shared = exposure?.shared_suppliers ?? [];
  const risks = exposure?.concentration_warnings ?? [];

  return (
    <Panel
      title="Portfolio supply-chain exposure"
      meta={exposure ? `${shared.length} shared · ${risks.length} risks` : undefined}
    >
      {enableNote ? <Note>{enableNote}</Note> : null}
      {loading && !exposure ? <div className={styles.loading}>Loading exposure…</div> : null}
      {status === "disabled" ? <Note>Set VALAFI_API_KEY to load exposure.</Note> : null}
      {status === "blocked" && !exposure ? (
        <Note tone="warn">Daily budget reached — exposure unavailable right now.</Note>
      ) : null}

      {exposure ? (
        <>
          <div className={styles.subhead}>
            <Boxes size={12} /> Shared suppliers ({shared.length})
          </div>
          {shared.length === 0 ? (
            <div className={styles.listEmpty}>No suppliers shared across multiple holdings.</div>
          ) : (
            <ul className={styles.sharedList}>
              {shared.slice(0, 6).map((s) => (
                <li key={s.supplier.ticker} className={styles.sharedRow}>
                  <Link
                    href={explorerHref(s.supplier.ticker) as never}
                    className={styles.sharedSupplier}
                  >
                    {s.supplier.ticker}
                    {s.supplier.name ? (
                      <span className={styles.sharedName}>{shortName(s.supplier.name, 22)}</span>
                    ) : null}
                  </Link>
                  <div className={styles.sharedBy}>
                    {s.dependent_holdings.map((t) => (
                      <Link key={t} href={explorerHref(t) as never} className={styles.sharedByChip}>
                        {t}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.subhead}>
            <ShieldAlert size={12} /> Concentration risk ({risks.length})
          </div>
          {risks.length === 0 ? (
            <div className={styles.listEmpty}>No single-source dependencies flagged.</div>
          ) : (
            <ul className={styles.riskList}>
              {risks.slice(0, 6).map((r, i) => (
                <li key={`${r.supplier.ticker}-${i}`} className={styles.riskRow}>
                  <Link
                    href={explorerHref(r.supplier.ticker) as never}
                    className={styles.riskSupplier}
                  >
                    {r.supplier.ticker}
                  </Link>
                  <span className={styles.riskMeta}>
                    {r.affected_holdings.length} holding
                    {r.affected_holdings.length === 1 ? "" : "s"} exposed
                  </span>
                  <RiskBadge level={r.severity} />
                </li>
              ))}
            </ul>
          )}

          <div className={styles.subhead}>
            <Zap size={12} /> Disruption test
          </div>
          <form
            className={styles.simRow}
            onSubmit={(e) => {
              e.preventDefault();
              void runSim();
            }}
          >
            <input
              className={styles.simInput}
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="Disrupt a supplier (e.g. TSM)…"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" className={styles.simBtn} disabled={simBusy || !simInput.trim()}>
              {simBusy ? "…" : "Simulate"}
            </button>
          </form>
          {sim ? (
            <div className={styles.simResult}>
              <div className={styles.simHead}>
                <strong>{sim.disrupted_company?.ticker ?? "?"}</strong> hits{" "}
                {sim.total_holdings_affected ?? 0} of your holdings
                {sim.portfolio_weighted_impact != null ? (
                  <span
                    className="mono"
                    style={{ color: impactColor(sim.portfolio_weighted_impact), marginLeft: 8 }}
                  >
                    book impact {Math.round(sim.portfolio_weighted_impact * 100)}
                  </span>
                ) : null}
              </div>
              <div className={styles.simChips}>
                {(sim.holdings_affected ?? []).slice(0, 8).map((h) => (
                  <Link
                    key={h.ticker}
                    href={explorerHref(h.ticker) as never}
                    className={styles.simChip}
                    style={{ borderColor: impactColor(h.impact_score ?? null) }}
                  >
                    {h.ticker}
                    <span className="mono" style={{ color: impactColor(h.impact_score ?? null) }}>
                      {Math.round((h.impact_score ?? 0) * 100)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Panel>
  );
}
