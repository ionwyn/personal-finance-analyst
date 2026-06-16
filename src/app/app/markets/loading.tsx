import {
  CurveSkeleton,
  MacroSkeleton,
  TapeSkeleton,
} from "@/components/features/markets/markets-parts/markets-skeletons";
import { PageHeaderSkeleton } from "@/components/shared/skeleton";

// Reuses the exact panel fallbacks the streaming <Suspense> boundaries render, so
// the initial-nav skeleton dissolves seamlessly into the streamed Markets view.
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={false} />
      <TapeSkeleton />
      <CurveSkeleton />
      <MacroSkeleton />
      <MacroSkeleton />
    </>
  );
}
