"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChart } from "@/components/shared/skeleton";

import type { SectorChartPoint } from "./sector-chart";

export const SectorChartDynamic = dynamic(
  () => import("./sector-chart").then((mod) => mod.SectorChart),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: 160, height: 160, flexShrink: 0 }}>
        <SkeletonChart variant="donut" />
      </div>
    ),
  }
) as (props: { data: SectorChartPoint[] }) => ReactNode;
