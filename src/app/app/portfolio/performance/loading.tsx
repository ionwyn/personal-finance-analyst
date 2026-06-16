import { AnalyticsBodySkeleton } from "@/components/features/analytics/analytics-parts/analytics-skeletons";
import { PageHeaderSkeleton } from "@/components/shared/skeleton";

// Reuses the in-view <Suspense> body fallback so the initial-nav skeleton matches
// the streamed Performance layout exactly.
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={false} />
      <AnalyticsBodySkeleton />
    </>
  );
}
