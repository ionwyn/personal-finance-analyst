"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { IncomeStats } from "@/lib/investments/analytics-loader";

const LoadingPanel = () => <div className="panel" style={{ minHeight: 270 }} />;

export const IncomePanelDynamic = dynamic(
  () => import("./income-panel").then((mod) => mod.IncomePanel),
  {
    ssr: false,
    loading: LoadingPanel,
  }
) as (props: { income: IncomeStats }) => ReactNode;
