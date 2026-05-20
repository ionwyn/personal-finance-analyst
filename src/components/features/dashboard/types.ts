import type { getDashboardData } from "@/lib/analytics";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
export type DashboardMode = "demo" | "private";
