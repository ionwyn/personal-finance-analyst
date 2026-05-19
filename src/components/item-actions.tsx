"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Unlink } from "lucide-react";

export function ItemActions({ itemId, status }: { itemId: string; status: string }) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"sync" | "balance" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "sync" | "balance") {
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(`/api/plaid/items/${itemId}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error(`Could not refresh ${action}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Refresh failed.");
    } finally {
      setBusyAction(null);
    }
  }

  const isSyncing = busyAction === "sync" || status === "SYNCING";

  return (
    <>
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => run("sync")}
        disabled={Boolean(busyAction) || status === "SYNCING"}
      >
        <RefreshCcw size={11} className={isSyncing ? "spin" : undefined} />
        Sync
      </button>
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => run("balance")}
        disabled={Boolean(busyAction)}
      >
        Refresh balance
      </button>
      <button
        className="btn btn-sm btn-danger"
        type="button"
        disabled
        title="Unlink not implemented"
      >
        <Unlink size={11} />
        Unlink
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}
