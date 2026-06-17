"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChart } from "@/components/shared/skeleton";

import type { IncomeChartPoint } from "./income-chart";

export const IncomeChartDynamic = dynamic(
  () => import("./income-chart").then((mod) => mod.IncomeChart),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: "100%", height: 120 }}>
        <SkeletonChart variant="bar" />
      </div>
    ),
  }
) as (props: { data: IncomeChartPoint[] }) => ReactNode;
