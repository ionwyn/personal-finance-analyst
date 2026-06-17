"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChart } from "@/components/shared/skeleton";

import type { CurveChartPoint } from "./curve-chart";

export const CurveChartDynamic = dynamic(
  () => import("./curve-chart").then((mod) => mod.CurveChart),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: "100%", height: 216 }}>
        <SkeletonChart variant="area" />
      </div>
    ),
  }
) as (props: { data: CurveChartPoint[]; domain: [number, number] }) => ReactNode;
