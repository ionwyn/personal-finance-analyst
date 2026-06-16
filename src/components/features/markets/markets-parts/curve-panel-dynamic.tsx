"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChartPanel } from "@/components/shared/skeleton";
import type { YieldCurveData } from "@/lib/market-data";

export const CurvePanelDynamic = dynamic(
  () => import("./curve-panel").then((mod) => mod.CurvePanel),
  {
    ssr: false,
    loading: () => <SkeletonChartPanel variant="area" height={216} />,
  }
) as (props: { curve: YieldCurveData }) => ReactNode;
