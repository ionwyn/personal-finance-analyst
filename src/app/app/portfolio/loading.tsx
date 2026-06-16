import {
  KpiStripSkeleton,
  PageHeaderSkeleton,
  SkeletonChartPanel,
  SkeletonPanel,
  SkeletonTable,
} from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <KpiStripSkeleton cells={3} />

      <div style={{ marginTop: 16 }}>
        <SkeletonChartPanel variant="area" height={260} />
      </div>

      <div style={{ marginTop: 16 }}>
        <SkeletonPanel bodyClassName="flush">
          <SkeletonTable rows={8} cols={6} gridTemplate="1.5fr 1fr 1fr 1fr 1fr 1fr" />
        </SkeletonPanel>
      </div>
    </>
  );
}
