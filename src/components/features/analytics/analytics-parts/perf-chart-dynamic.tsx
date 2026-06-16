"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChartPanel } from "@/components/shared/skeleton";
import type { SeriesPoint } from "@/lib/investments/analytics-loader";

export const PerfChartDynamic = dynamic(() => import("./perf-chart").then((mod) => mod.PerfChart), {
  ssr: false,
  loading: () => <SkeletonChartPanel variant="area" height={380} />,
}) as (props: { series: SeriesPoint[]; fxNote: string; mwrPct: number | null }) => ReactNode;
