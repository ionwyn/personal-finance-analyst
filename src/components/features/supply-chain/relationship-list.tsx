"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { SegmentedControl } from "@/components/ui";
import type { ValafiEdge } from "@/lib/valafi/types";

import { counterpart, relColor, shortName } from "./format";
import { EvidenceCard, ProChip } from "./sc-primitives";
import styles from "./splc.module.scss";

type Tab = "suppliers" | "customers" | "competitors";

export function RelationshipList({
  center,
  suppliers,
  customers,
  competitors,
  onSelect,
}: {
  center: string;
  suppliers: ValafiEdge[];
  customers: ValafiEdge[];
  competitors: ValafiEdge[];
  onSelect?: (ticker: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("suppliers");
  const sets: Record<Tab, ValafiEdge[]> = { suppliers, customers, competitors };
  const edges = sets[tab];
  const accent = relColor(tab.replace(/s$/, ""));

  return (
    <div className={styles.list}>
      <SegmentedControl<Tab>
        label="Relationship type"
        value={tab}
        onChange={setTab}
        variant="accent"
        options={[
          { value: "suppliers", label: `Suppliers ${suppliers.length}` },
          { value: "customers", label: `Customers ${customers.length}` },
          { value: "competitors", label: `Competitors ${competitors.length}` },
        ]}
      />

      {edges.length === 0 ? (
        <div className={styles.listEmpty}>No {tab} found in the latest filings.</div>
      ) : (
        <ul className={styles.listRows}>
          {edges.map((e, i) => {
            const co = counterpart(e, center);
            const evidence = i < 2 ? e.evidence : null;
            return (
              <li key={`${co.ticker}-${i}`} className={styles.listRow}>
                <button
                  type="button"
                  className={styles.listMain}
                  onClick={() => onSelect?.(co.ticker)}
                  disabled={!onSelect}
                  title={onSelect ? `Explore ${co.ticker}` : undefined}
                >
                  <span className={styles.listDot} style={{ background: accent }} />
                  <span className={styles.listTicker}>{co.ticker}</span>
                  <span className={styles.listName}>{shortName(co.name, 40)}</span>
                  {onSelect ? <ArrowRight size={12} className={styles.listArrow} /> : null}
                </button>
                <div className={styles.listMeta}>
                  {e.hop != null ? <span className={styles.hop}>{e.hop} hop</span> : null}
                  <ProChip />
                </div>
                {evidence ? <EvidenceCard text={evidence} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      {edges.length > 2 ? (
        <div className={styles.listFoot}>
          Evidence shown for the top 2 · full evidence on Vala-Fi Pro
        </div>
      ) : null}
    </div>
  );
}
