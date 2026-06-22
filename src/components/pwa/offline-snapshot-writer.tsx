"use client";

import { useEffect } from "react";

import type { DashboardData, DashboardMode } from "@/components/features/dashboard/types";
import type { CalendarData } from "@/lib/calendar/get-calendar-events";
import type { InvestmentDashboardData } from "@/lib/investments/types";
import {
  buildCalendarSnapshot,
  buildDashboardSnapshot,
  buildHoldingsSnapshot,
  saveOfflineSnapshot,
} from "@/lib/pwa/offline-snapshots";

type Props =
  | { kind: "dashboard"; data: DashboardData; mode: DashboardMode }
  | { kind: "holdings"; data: InvestmentDashboardData; mode?: DashboardMode | "unknown" }
  | { kind: "calendar"; data: CalendarData; mode?: DashboardMode | "unknown" };

export function OfflineSnapshotWriter(props: Props) {
  useEffect(() => {
    if (props.kind === "dashboard") {
      void saveOfflineSnapshot("dashboard", buildDashboardSnapshot(props.data), props.mode);
      return;
    }

    if (props.kind === "holdings") {
      void saveOfflineSnapshot(
        "holdings",
        buildHoldingsSnapshot(props.data),
        props.mode ?? "unknown"
      );
      return;
    }

    void saveOfflineSnapshot(
      "calendar",
      buildCalendarSnapshot(props.data),
      props.mode ?? "unknown"
    );
  }, [props]);

  return null;
}
