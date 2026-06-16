import {
  KpiStripSkeleton,
  PageHeaderSkeleton,
  SkeletonChart,
  SkeletonLine,
  SkeletonPanel,
  SkeletonTable,
} from "@/components/shared/skeleton";
import styles from "@/components/features/dashboard/dashboard-view.module.scss";

// Segment-wide fallback (also the dashboard's own loader). Next.js renders the
// nearest loading.tsx, so this streams instantly into the persistent shell for
// any /app route that doesn't define its own.
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <KpiStripSkeleton />

      <div className={styles.dashGrid}>
        <div className={styles.col}>
          <SkeletonPanel bodyStyle={{ height: 240 }}>
            <SkeletonChart variant="bar" />
          </SkeletonPanel>
          <SkeletonPanel bodyStyle={{ height: 200 }}>
            <SkeletonChart variant="area" />
          </SkeletonPanel>
          <SkeletonPanel bodyClassName="flush">
            <SkeletonTable rows={6} cols={5} gridTemplate="100px 1fr 1fr 1fr 110px" />
          </SkeletonPanel>
        </div>

        <div className={styles.col}>
          <SkeletonPanel bodyStyle={{ height: 150 }} />
          <SkeletonPanel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 14,
                alignItems: "center",
              }}
            >
              <SkeletonChart variant="donut" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonLine key={i} width={`${90 - i * 10}%`} />
                ))}
              </div>
            </div>
          </SkeletonPanel>
          <SkeletonPanel bodyStyle={{ height: 160 }} />
        </div>
      </div>
    </>
  );
}
