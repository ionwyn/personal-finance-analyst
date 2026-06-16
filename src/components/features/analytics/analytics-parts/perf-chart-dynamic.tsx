"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { SeriesPoint } from "@/lib/investments/analytics-loader";

const LoadingPanel = () => <div className="panel ana-chart-panel" style={{ minHeight: 430 }} />;

export const PerfChartDynamic = dynamic(() => import("./perf-chart").then((mod) => mod.PerfChart), {
  ssr: false,
  loading: LoadingPanel,
}) as (props: { series: SeriesPoint[]; fxNote: string; mwrPct: number | null }) => ReactNode;
