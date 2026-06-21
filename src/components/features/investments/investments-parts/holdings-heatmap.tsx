"use client";

import { useMemo } from "react";
import { Treemap, ResponsiveContainer, type TreemapNode } from "recharts";

import { formatMoney } from "@/lib/format";
import type { InvestmentPosition } from "@/lib/investments/types";

import { mergePositionsBySymbol } from "./merge-positions";

// ─── Color: pure red/green gradient, dark → bright with magnitude ─────────────

function plColor(plPct: number | null): string {
  if (plPct == null) return "#1a1a1d";
  const ratio = Math.min(Math.abs(plPct) / 25, 1); // saturates at ±25%
  const l = Math.round(10 + ratio * 28); // 10% → 38% lightness
  const s = Math.round(30 + ratio * 50); // 30% → 80% saturation
  return plPct >= 0 ? `hsl(142 ${s}% ${l}%)` : `hsl(0 ${s}% ${l}%)`;
}

// ─── Font: proportional to min cell dimension ─────────────────────────────────

function cellFonts(w: number, h: number, margin: number) {
  const side = Math.min(w - margin * 2, h - margin * 2);
  const rawPx = Math.floor(side / 6);
  if (rawPx < 9) return { symPx: 0, pctPx: 0, showPct: false };
  const symPx = Math.min(rawPx, 18);
  const showPct = symPx >= 11 && side > 44;
  const pctPx = showPct ? Math.max(8, Math.round(symPx * 0.76)) : 0;
  return { symPx, pctPx, showPct };
}

// ─── Cell renderer (created as closure to capture isSectorMode) ───────────────

type ExtraFields = {
  plPct?: number | null;
  mvCAD?: number;
  isSectorGroup?: boolean;
  sectorLabel?: string;
};

function makeRenderer(isSectorMode: boolean) {
  return function renderCell(props: TreemapNode) {
    const { x, y, width, height, depth, name } = props;
    const { plPct, mvCAD, isSectorGroup, sectorLabel } = props as unknown as ExtraFields;

    if (depth === 0 || width < 2 || height < 2) return <g />;

    // Sector group: crisp neutral border, no color, renders under position cells
    if (isSectorGroup) {
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={4}
          />
        </g>
      );
    }

    // Position cell
    const margin = isSectorMode ? 3 : 1;
    const fill = plColor(plPct ?? null);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const { symPx, pctPx, showPct } = cellFonts(width, height, margin);
    const showSym = symPx > 0 && width > margin * 2 + 16;
    const pctStr = plPct != null ? `${plPct >= 0 ? "+" : "−"}${Math.abs(plPct).toFixed(1)}%` : null;

    return (
      <g>
        <title>
          {name}
          {mvCAD != null ? ` · ${formatMoney(mvCAD)}` : ""}
          {pctStr ? ` · Total P&L ${pctStr}` : " · No cost basis"}
        </title>
        <rect
          x={x + margin}
          y={y + margin}
          width={Math.max(0, width - margin * 2)}
          height={Math.max(0, height - margin * 2)}
          fill={fill}
          rx={2}
        />

        {/* Sector label: top-left chip on the largest cell of each sector */}
        {sectorLabel && width > margin * 2 + 55 && (
          <>
            <rect
              x={x + margin + 2}
              y={y + margin + 2}
              width={Math.min(width - margin * 2 - 6, sectorLabel.length * 5.5 + 12)}
              height={15}
              fill="rgba(0,0,0,0.6)"
              rx={2}
            />
            <text
              x={x + margin + 7}
              y={y + margin + 12}
              fontSize={8.5}
              letterSpacing="0.07em"
              fill="rgba(255,255,255,0.72)"
              style={{ userSelect: "none" }}
            >
              {sectorLabel.toUpperCase()}
            </text>
          </>
        )}

        {/* Symbol */}
        {showSym && (
          <text
            x={cx}
            y={cy + (showPct && pctStr ? -(pctPx * 0.65) : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={symPx}
            fontWeight={600}
            fill="rgba(255,255,255,0.9)"
            fontFamily="var(--font-mono, monospace)"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {name}
          </text>
        )}

        {/* P&L % */}
        {showPct && pctStr && (
          <text
            x={cx}
            y={cy + symPx * 0.6 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={pctPx}
            fill="rgba(255,255,255,0.62)"
            fontFamily="var(--font-mono, monospace)"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {pctStr}
          </text>
        )}
      </g>
    );
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export type HeatmapGroupBy = "mv" | "sector";

export type HoldingsHeatmapProps = {
  rows: InvestmentPosition[];
  sectorBySymbol: Record<string, string>;
  groupBy: HeatmapGroupBy;
  onNavigate: (symbol: string) => void;
};

export function HoldingsHeatmap({
  rows,
  sectorBySymbol,
  groupBy,
  onNavigate,
}: HoldingsHeatmapProps) {
  const merged = useMemo(() => mergePositionsBySymbol(rows), [rows]);
  const isSectorMode = groupBy === "sector";

  const treeData = useMemo(() => {
    if (!isSectorMode) {
      return merged.map((p) => ({
        name: p.symbol,
        value: p.mvCAD,
        plPct: p.plPct,
        mvCAD: p.mvCAD,
      }));
    }

    // Group by sector, sorted by aggregate MV desc
    const groups = new Map<string, InvestmentPosition[]>();
    for (const p of merged) {
      const sector = sectorBySymbol[p.symbol] ?? "Unclassified";
      const existing = groups.get(sector) ?? [];
      existing.push(p);
      groups.set(sector, existing);
    }

    const sorted = [...groups.entries()].sort(
      (a, b) => b[1].reduce((s, p) => s + p.mvCAD, 0) - a[1].reduce((s, p) => s + p.mvCAD, 0)
    );

    return sorted.map(([sector, positions]) => {
      const byMv = [...positions].sort((a, b) => b.mvCAD - a.mvCAD);
      return {
        name: sector,
        isSectorGroup: true,
        children: byMv.map((p, idx) => ({
          name: p.symbol,
          value: p.mvCAD,
          plPct: p.plPct,
          mvCAD: p.mvCAD,
          // Attach sector label to the first (largest) position cell
          sectorLabel: idx === 0 ? sector : undefined,
        })),
      };
    });
  }, [merged, sectorBySymbol, isSectorMode]);

  const renderer = useMemo(() => makeRenderer(isSectorMode), [isSectorMode]);

  if (merged.length === 0) {
    return (
      <div className="panel">
        <div
          className="panel-body"
          style={{
            padding: "48px 20px",
            textAlign: "center",
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          No holdings to display
        </div>
      </div>
    );
  }

  return (
    <div className="heatmap-wrap">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">
            {isSectorMode ? "Holdings by Sector" : "Holdings"} · {merged.length}
          </div>
          <div className="panel-meta">SIZE = MARKET VALUE (CAD) · COLOR = TOTAL P&L %</div>
        </div>
        <div className="panel-body flush">
          <ResponsiveContainer width="100%" height={480}>
            <Treemap
              data={treeData}
              dataKey="value"
              content={renderer}
              isAnimationActive={false}
              onClick={(node) => {
                if (node.depth > 0 && node.children === null) {
                  onNavigate(node.name as string);
                }
              }}
              style={{ cursor: "pointer" }}
            />
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
