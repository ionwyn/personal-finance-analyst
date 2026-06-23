"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";

import { Panel } from "@/components/ui";
import type { ValafiPath, ValafiUsageSnapshot } from "@/lib/valafi/types";

import { fetchPath } from "./api";
import { relColor, shortName } from "./format";
import { normalizeInput } from "./input";
import { Note, SpendConfirm } from "./sc-primitives";
import type { PickHolding } from "./types";
import { publishUsage } from "./usage-bus";
import styles from "./splc.module.scss";

export function PathView({ holdings }: { holdings: PickHolding[] }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [path, setPath] = useState<ValafiPath | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [usage, setUsage] = useState<ValafiUsageSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (confirm = false) => {
    const ta = normalizeInput(a);
    const tb = normalizeInput(b);
    if (!ta || !tb) return;
    setBusy(true);
    setNeedsConfirm(false);
    try {
      const res = await fetchPath(ta, tb, confirm);
      publishUsage(res.usage);
      setUsage(res.usage);
      setStatus(res.status);
      setMessage(res.message);
      if (res.needsConfirm) setNeedsConfirm(true);
      else setPath(res.data);
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const tracked = holdings.filter((h) => h.trackable).slice(0, 10);
  const nodes = path?.path ?? [];

  return (
    <div className={styles.pathView}>
      <Panel title="Pathfinder" meta="six degrees of supply chain">
        <form
          className={styles.pathForm}
          onSubmit={(e) => {
            e.preventDefault();
            void run(false);
          }}
        >
          <input
            className={styles.pickerInput}
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="From (e.g. AAPL)"
            spellCheck={false}
            autoComplete="off"
          />
          <ArrowRight size={14} className={styles.pathArrow} />
          <input
            className={styles.pickerInput}
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="To (e.g. NVDA)"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            className={styles.pickerBtn}
            disabled={busy || !a.trim() || !b.trim()}
          >
            <Route size={12} />
            {busy ? "…" : "Find path"}
          </button>
        </form>

        {tracked.length > 0 ? (
          <div className={styles.quickPicks}>
            <span className={styles.quickLabel}>Set endpoint</span>
            {tracked.map((h) => (
              <span key={h.symbol} className={styles.pathPick}>
                <button type="button" className={styles.quickChip} onClick={() => setA(h.symbol)}>
                  {h.symbol}
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </Panel>

      {needsConfirm && usage ? (
        <SpendConfirm usage={usage} onConfirm={() => run(true)} busy={busy} label="Find anyway" />
      ) : null}

      {status === "empty" && !needsConfirm ? (
        <Note tone="warn">{message ?? "No documented path between those companies."}</Note>
      ) : null}
      {status === "disabled" ? <Note>Set VALAFI_API_KEY to trace paths.</Note> : null}
      {status === "blocked" && !needsConfirm ? (
        <Note tone="warn">Daily company limit reached — try again tomorrow.</Note>
      ) : null}

      {nodes.length > 0 ? (
        <Panel title="Connection" meta={`${path?.path_length ?? nodes.length - 1} hops`}>
          <div className={styles.pathChain}>
            {nodes.map((n, i) => {
              const edge = path?.edges?.[i];
              return (
                <div key={`${n.ticker}-${i}`} className={styles.pathStep}>
                  <Link
                    href={
                      `/app/supply-chain/explorer?ticker=${encodeURIComponent(n.ticker)}` as never
                    }
                    className={styles.pathNode}
                  >
                    <span className={styles.pathTicker}>{n.ticker}</span>
                    <span className={styles.pathName}>{shortName(n.name, 20)}</span>
                  </Link>
                  {i < nodes.length - 1 ? (
                    <span className={styles.pathConnector}>
                      <span
                        className={styles.pathRel}
                        style={{ color: relColor(edge?.relationship_type) }}
                      >
                        {edge?.relationship_type ?? "linked"}
                      </span>
                      <ArrowRight size={14} />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
