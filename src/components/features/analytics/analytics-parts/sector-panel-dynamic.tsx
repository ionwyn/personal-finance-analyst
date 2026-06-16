"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { SectorSlice } from "@/lib/investments/types";

const LoadingPanel = () => <div className="panel" style={{ minHeight: 300 }} />;

export const SectorPanelDynamic = dynamic(
  () => import("./sector-panel").then((mod) => mod.SectorPanel),
  {
    ssr: false,
    loading: LoadingPanel,
  }
) as (props: { sectors: SectorSlice[] }) => ReactNode;
