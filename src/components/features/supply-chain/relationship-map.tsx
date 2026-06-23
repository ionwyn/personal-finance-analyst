"use client";

import { useState } from "react";

import type { ValafiCompany, ValafiEdge } from "@/lib/valafi/types";

import { counterpart, relColor, shortName } from "./format";
import { NodeChip } from "./sc-primitives";
import styles from "./splc.module.scss";

type Endpoint = Partial<ValafiCompany> & { ticker: string };

const NODE_H = 46;
const GAP = 16;
const PAD = 28;
const VB_W = 1000;
const COL_W = 224;
const CENTER_W = 188;
const SUP_X = 36;
const CUS_X = VB_W - 36 - COL_W;
const CEN_X = (VB_W - CENTER_W) / 2;

function columnHeight(n: number): number {
  return n > 0 ? n * NODE_H + (n - 1) * GAP : 0;
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function RelationshipMap({
  center,
  suppliers,
  customers,
  competitors,
  onSelect,
}: {
  center: { ticker: string; name?: string | null; sector?: string | null };
  suppliers: ValafiEdge[];
  customers: ValafiEdge[];
  competitors: ValafiEdge[];
  onSelect?: (ticker: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const sup = suppliers.slice(0, 5).map((e) => ({ edge: e, co: counterpart(e, center.ticker) }));
  const cus = customers.slice(0, 5).map((e) => ({ edge: e, co: counterpart(e, center.ticker) }));

  const height =
    Math.max(columnHeight(sup.length), columnHeight(cus.length), NODE_H + 40) + PAD * 2;
  const midY = height / 2;

  const colY = (count: number, i: number) => {
    const block = columnHeight(count);
    return (height - block) / 2 + i * (NODE_H + GAP);
  };

  const supColor = relColor("supplier");
  const cusColor = relColor("customer");

  const renderNode = (
    co: Endpoint,
    x: number,
    y: number,
    accent: string,
    side: "left" | "right"
  ) => {
    const dim = hover != null && hover !== co.ticker && hover !== center.ticker;
    return (
      <g
        key={`${side}-${co.ticker}`}
        className={styles.svgNode}
        opacity={dim ? 0.35 : 1}
        onMouseEnter={() => setHover(co.ticker)}
        onMouseLeave={() => setHover(null)}
        onClick={() => onSelect?.(co.ticker)}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={(e) => {
          if (onSelect && (e.key === "Enter" || e.key === " ")) onSelect(co.ticker);
        }}
      >
        <title>{`${co.ticker}${co.name ? ` · ${co.name}` : ""}`}</title>
        <rect
          x={x}
          y={y}
          width={COL_W}
          height={NODE_H}
          rx={6}
          className={styles.svgNodeRect}
          stroke={hover === co.ticker ? accent : "var(--border-strong)"}
        />
        <rect x={x} y={y} width={3} height={NODE_H} rx={1.5} fill={accent} />
        <text x={side === "left" ? x + 16 : x + 16} y={y + 19} className={styles.svgTicker}>
          {co.ticker}
        </text>
        <text x={x + 16} y={y + 35} className={styles.svgName}>
          {shortName(co.name, 26)}
        </text>
      </g>
    );
  };

  return (
    <div className={styles.mapWrap}>
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        className={styles.mapSvg}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Supply chain map for ${center.ticker}`}
      >
        <text x={SUP_X + 4} y={16} className={styles.svgColHead} fill={supColor}>
          SUPPLIERS · {suppliers.length}
        </text>
        <text x={CUS_X + 4} y={16} className={styles.svgColHead} fill={cusColor}>
          CUSTOMERS · {customers.length}
        </text>

        {/* Edges (behind nodes) */}
        {sup.map(({ co }, i) => {
          const y = colY(sup.length, i) + NODE_H / 2;
          const active = hover === co.ticker || hover === center.ticker;
          return (
            <path
              key={`se-${co.ticker}`}
              d={edgePath(SUP_X + COL_W, y, CEN_X, midY)}
              className={styles.edge}
              stroke={supColor}
              strokeWidth={active ? 2.4 : 1.2}
              opacity={hover == null ? 0.55 : active ? 0.95 : 0.18}
            />
          );
        })}
        {cus.map(({ co }, i) => {
          const y = colY(cus.length, i) + NODE_H / 2;
          const active = hover === co.ticker || hover === center.ticker;
          return (
            <path
              key={`ce-${co.ticker}`}
              d={edgePath(CEN_X + CENTER_W, midY, CUS_X, y)}
              className={styles.edge}
              stroke={cusColor}
              strokeWidth={active ? 2.4 : 1.2}
              opacity={hover == null ? 0.55 : active ? 0.95 : 0.18}
            />
          );
        })}

        {/* Centre company */}
        <g onMouseEnter={() => setHover(center.ticker)} onMouseLeave={() => setHover(null)}>
          <title>{`${center.ticker}${center.name ? ` · ${center.name}` : ""}`}</title>
          <rect
            x={CEN_X}
            y={midY - 36}
            width={CENTER_W}
            height={72}
            rx={8}
            className={styles.svgCenterRect}
          />
          <text x={CEN_X + CENTER_W / 2} y={midY - 4} className={styles.svgCenterTicker}>
            {center.ticker}
          </text>
          <text x={CEN_X + CENTER_W / 2} y={midY + 16} className={styles.svgCenterSub}>
            {shortName(center.sector ?? center.name, 22)}
          </text>
        </g>

        {sup.map(({ co }, i) => renderNode(co, SUP_X, colY(sup.length, i), supColor, "left"))}
        {cus.map(({ co }, i) => renderNode(co, CUS_X, colY(cus.length, i), cusColor, "right"))}
      </svg>

      {competitors.length > 0 ? (
        <div className={styles.compRow}>
          <span className={styles.compLabel} style={{ color: relColor("competitor") }}>
            COMPETITORS
          </span>
          <div className={styles.compChips}>
            {competitors.slice(0, 5).map((e) => {
              const co = counterpart(e, center.ticker);
              return (
                <NodeChip
                  key={co.ticker}
                  ticker={co.ticker}
                  name={shortName(co.name, 18)}
                  color={relColor("competitor")}
                  onClick={onSelect ? () => onSelect(co.ticker) : undefined}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
