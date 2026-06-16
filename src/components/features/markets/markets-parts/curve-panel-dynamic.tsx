"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { YieldCurveData } from "@/lib/market-data";

const LoadingPanel = () => <div className="panel" style={{ minHeight: 320 }} />;

export const CurvePanelDynamic = dynamic(
  () => import("./curve-panel").then((mod) => mod.CurvePanel),
  {
    ssr: false,
    loading: LoadingPanel,
  }
) as (props: { curve: YieldCurveData }) => ReactNode;
