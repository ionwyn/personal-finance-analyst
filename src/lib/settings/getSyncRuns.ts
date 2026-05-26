import { prisma } from "@/lib/prisma";

export type SyncRunRow = {
  id: string;
  source: string;
  status: string;
  institution: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  added: number;
  modified: number;
  removed: number;
  errorCode: string | null;
  errorMessage: string | null;
};

/** Recent sync runs for the Connections & Sync settings section. */
export async function getSyncRuns(tenantId: string, take = 20): Promise<SyncRunRow[]> {
  const runs = await prisma.syncRun.findMany({
    where: { tenantId },
    orderBy: { startedAt: "desc" },
    take,
    include: { item: { select: { institutionName: true } } },
  });

  return runs.map((r) => ({
    id: r.id,
    source: r.source,
    status: r.status,
    institution: r.item?.institutionName ?? "—",
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    durationMs: r.completedAt ? r.completedAt.getTime() - r.startedAt.getTime() : null,
    added: r.addedCount,
    modified: r.modifiedCount,
    removed: r.removedCount,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
  }));
}
