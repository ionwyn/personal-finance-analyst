"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Unlink } from "lucide-react";

import { Button } from "@/components/ui";

export function ItemActions({ itemId, status }: { itemId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/plaid/items/${itemId}/sync`, { method: "POST" });
      if (!response.ok) throw new Error("Could not sync.");
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  const isSyncing = busy || status === "SYNCING";

  return (
    <>
      <Button
        size="sm"
        onClick={sync}
        disabled={isSyncing}
        icon={<RefreshCcw size={11} className={isSyncing ? "spin" : undefined} />}
      >
        Sync
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled
        title="Unlink not implemented"
        icon={<Unlink size={11} />}
      >
        Unlink
      </Button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}
