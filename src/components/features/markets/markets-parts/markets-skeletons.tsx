// Shared streaming fallbacks for Markets → Overview. Reused by both the route
// `loading.tsx` (initial-nav skeleton) and the in-view <Suspense> boundaries, so
// the transition from route skeleton → streamed panels is seamless. Each mirrors
// the real component's container class (`.mkt-tape`, `.mkt-macro-grid`) for
// pixel-aligned layout (no shift).

import { SkeletonChartPanel, SkeletonLine } from "@/components/shared/skeleton";

export function TapeSkeleton() {
  return (
    <div className="mkt-tape" aria-busy="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <div className="mkt-tape-cell" key={i}>
          <SkeletonLine width={52} height={9} />
          <SkeletonLine width={70} height={15} style={{ marginTop: 8 }} />
          <SkeletonLine width={40} height={10} style={{ marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

export function CurveSkeleton() {
  return <SkeletonChartPanel variant="area" height={216} />;
}

export function MacroSkeleton() {
  return (
    <div className="panel mkt-macro" aria-busy="true">
      <div className="panel-head">
        <SkeletonLine width={120} height={11} />
        <SkeletonLine width={56} height={11} />
      </div>
      <div className="mkt-macro-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            className="mkt-macro-cell"
            key={i}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <SkeletonLine width="55%" height={9} />
            <SkeletonLine width="80%" height={16} />
            <SkeletonLine width="100%" height={20} />
          </div>
        ))}
      </div>
    </div>
  );
}
