"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChartPanel } from "@/components/shared/skeleton";
import type { IncomeStats } from "@/lib/investments/analytics-loader";

export const IncomePanelDynamic = dynamic(
  () => import("./income-panel").then((mod) => mod.IncomePanel),
  {
    ssr: false,
    loading: () => <SkeletonChartPanel variant="bar" height={220} />,
  }
) as (props: { income: IncomeStats }) => ReactNode;
