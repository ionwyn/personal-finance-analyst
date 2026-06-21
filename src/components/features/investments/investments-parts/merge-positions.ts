import type { InvestmentPosition } from "@/lib/investments/types";

export function mergePositionsBySymbol(positions: InvestmentPosition[]): InvestmentPosition[] {
  const groups = new Map<string, InvestmentPosition[]>();
  for (const pos of positions) {
    const existing = groups.get(pos.symbol);
    if (existing) existing.push(pos);
    else groups.set(pos.symbol, [pos]);
  }

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    const first = group[0];
    const units = group.reduce((s, p) => s + p.units, 0);
    const mvNative = group.reduce((s, p) => s + p.mvNative, 0);
    const mvCAD = group.reduce((s, p) => s + p.mvCAD, 0);

    const allHaveCostNative = group.every((p) => p.costNative != null);
    const costNative = allHaveCostNative ? group.reduce((s, p) => s + p.costNative!, 0) : null;

    const allHaveCostCAD = group.every((p) => p.costCAD != null);
    const costCAD = allHaveCostCAD ? group.reduce((s, p) => s + p.costCAD!, 0) : null;

    const avgCost = costNative != null ? costNative / units : null;

    const plCADValues = group.filter((p) => p.plCAD != null).map((p) => p.plCAD!);
    const plCAD = plCADValues.length > 0 ? plCADValues.reduce((s, v) => s + v, 0) : null;

    // Multiply by 100: consistent with pnlPct stored in DB as percentage (e.g. 5.23 = 5.23%)
    const plPct =
      plCAD != null && costCAD != null && costCAD !== 0 ? (plCAD / costCAD) * 100 : null;

    return {
      ...first,
      id: group.map((p) => p.id).join("+"),
      accountId: "",
      units,
      mvNative,
      mvCAD,
      costNative,
      costCAD,
      avgCost,
      plCAD,
      plPct,
    };
  });
}
