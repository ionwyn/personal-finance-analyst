"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { SkeletonChartPanel } from "@/components/shared/skeleton";
import type { SectorSlice } from "@/lib/investments/types";

export const SectorPanelDynamic = dynamic(
  () => import("./sector-panel").then((mod) => mod.SectorPanel),
  {
    ssr: false,
    loading: () => <SkeletonChartPanel variant="bar" height={250} />,
  }
) as (props: { sectors: SectorSlice[] }) => ReactNode;
