"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChart, SkeletonPanel } from "@/components/shared/skeleton";
import type { PositionMarketData } from "@/lib/market-data";
import type { PositionActivityRow } from "@/lib/investments/types";

const PriceLoading = () => (
  <div className="pos-chart-wrap" style={{ height: 380 }}>
    <SkeletonChart variant="area" height={360} />
  </div>
);

const TechnicalsLoading = () => (
  <SkeletonPanel title={false} bodyStyle={{ height: 72, display: "flex", alignItems: "center" }}>
    <SkeletonChart variant="bar" bars={8} height={48} />
  </SkeletonPanel>
);

export const PriceChartDynamic = dynamic(
  () => import("./position-market").then((mod) => mod.PriceChart),
  {
    ssr: false,
    loading: PriceLoading,
  }
) as (props: {
  md: PositionMarketData | null;
  avgNative: number | null;
  activity?: PositionActivityRow[];
}) => ReactNode;

export const TechnicalsPanelDynamic = dynamic(
  () => import("./position-market").then((mod) => mod.TechnicalsPanel),
  {
    ssr: false,
    loading: TechnicalsLoading,
  }
) as (props: { md: PositionMarketData | null }) => ReactNode;
