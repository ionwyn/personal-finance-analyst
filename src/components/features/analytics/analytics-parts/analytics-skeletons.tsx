// Streaming fallback for Performance → analytics body. Shared by the route
// `loading.tsx` and the in-view <Suspense> boundary so the initial-nav skeleton
// dissolves seamlessly into the streamed view. Mirrors the real layout: a tall
// TWR chart, the risk panel, then the income/calendar `.ana-grid`.

import { SkeletonChartPanel, SkeletonPanel } from "@/components/shared/skeleton";

export function AnalyticsBodySkeleton() {
  return (
    <>
      <SkeletonChartPanel variant="area" height={380} />

      <div style={{ marginTop: 14 }}>
        <SkeletonPanel bodyStyle={{ height: 120 }} />
      </div>

      <div className="ana-grid">
        <SkeletonChartPanel variant="bar" height={240} />
        <SkeletonPanel bodyStyle={{ height: 240 }} />
      </div>
    </>
  );
}
