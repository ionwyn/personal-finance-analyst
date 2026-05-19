"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui";

export function SyncAllButton({ items }: { items: Array<{ id: string; status: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function syncAll() {
    setBusy(true);
    setError(null);
    try {
      await Promise.allSettled(
        items.map((item) => fetch(`/api/plaid/items/${item.id}/sync`, { method: "POST" }))
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={syncAll}
        disabled={busy}
        icon={<RefreshCcw size={12} className={busy ? "spin" : undefined} />}
      >
        {busy ? "Syncing…" : "Sync all"}
      </Button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}
