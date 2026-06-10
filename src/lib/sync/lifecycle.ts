import { SyncRunStatus } from "@prisma/client";

export const ACTIVE_LOCK_MS = 15 * 60 * 1000;
export const STUCK_SYNC_ERROR_CODE = "STUCK_SYNC_RECOVERY";

const STUCK_RUN_MESSAGE = "Sync run was stuck in RUNNING state and was reset by the watchdog.";

// Loose typing: Prisma's per-model updateMany has model-specific arg types
// that aren't structurally compatible across delegates. Accept any args here —
// the call sites pass shape-correct payloads.
type WriteDelegate = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMany: (args: any) => Promise<unknown>;
};

export async function recoverStuckSyncEntities(opts: {
  runDelegate: WriteDelegate;
  entityDelegate: WriteDelegate;
  entityStuckStatus: string;
  entityResetStatus: string;
  entityResetMessage: string;
  runResetMessage?: string;
}) {
  const cutoff = new Date(Date.now() - ACTIVE_LOCK_MS);

  await opts.runDelegate.updateMany({
    where: { status: SyncRunStatus.RUNNING, startedAt: { lt: cutoff } },
    data: {
      status: SyncRunStatus.ERROR,
      completedAt: new Date(),
      errorCode: STUCK_SYNC_ERROR_CODE,
      errorMessage: opts.runResetMessage ?? STUCK_RUN_MESSAGE,
    },
  });

  await opts.entityDelegate.updateMany({
    where: { status: opts.entityStuckStatus, updatedAt: { lt: cutoff } },
    data: {
      status: opts.entityResetStatus,
      errorCode: STUCK_SYNC_ERROR_CODE,
      errorMessage: opts.entityResetMessage,
    },
  });
}
