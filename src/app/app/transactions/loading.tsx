import {
  PageHeaderSkeleton,
  SkeletonLine,
  SkeletonPanel,
  SkeletonTable,
} from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />

      {/* Summary bar — Rows / Income / Spending / Net */}
      <div className="summary-bar" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="cell" key={i}>
            <SkeletonLine width={60} height={10} />
            <SkeletonLine width={88} height={18} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>

      {/* Filter toolbar */}
      <div style={{ margin: "14px 0" }}>
        <SkeletonLine width="100%" height={36} />
      </div>

      {/* Transaction table — Date / Merchant / Account / Category / Amount */}
      <SkeletonPanel title={false} bodyClassName="flush">
        <SkeletonTable rows={12} cols={5} gridTemplate="110px 1fr 1fr 1fr 130px" />
      </SkeletonPanel>
    </>
  );
}
