"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { PositionMarketData } from "@/lib/market-data";
import type { PositionActivityRow } from "@/lib/investments/types";

const PriceLoading = () => <div className="pos-chart-wrap" style={{ minHeight: 380 }} />;
const TechnicalsLoading = () => <div className="panel" style={{ minHeight: 96 }} />;

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
