"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, RefreshCcw, Unlink } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";

import { Button } from "@/components/ui";

export function ItemActions({ itemId, status }: { itemId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "unlink" | "reauth" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthToken, setReauthToken] = useState<string | null>(null);
  const pendingOpenRef = useRef(false);

  const { open, ready } = usePlaidLink({
    token: reauthToken,
    onSuccess: async () => {
      // Update mode repaired the item in place; pull fresh data and refresh.
      try {
        await fetch(`/api/plaid/items/${itemId}/sync`, { method: "POST" });
      } catch {
        // sync failure is non-fatal — the item is already re-authenticated
      }
      setReauthToken(null);
      router.refresh();
    },
    onExit: () => {
      setReauthToken(null);
      setBusy(null);
    },
  });

  useEffect(() => {
    if (pendingOpenRef.current && reauthToken && ready) {
      pendingOpenRef.current = false;
      setBusy(null);
      open();
    }
  }, [open, ready, reauthToken]);

  async function sync() {
    setBusy("sync");
    setError(null);
    try {
      const response = await fetch(`/api/plaid/items/${itemId}/sync`, { method: "POST" });
      if (!response.ok) throw new Error("Could not sync.");
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed.");
    } finally {
      setBusy(null);
    }
  }

  const reauth = useCallback(async () => {
    setBusy("reauth");
    setError(null);
    try {
      const response = await fetch(`/api/plaid/items/${itemId}/update-link-token`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not start re-authentication.");
      const body = (await response.json()) as { link_token: string };
      pendingOpenRef.current = true;
      setReauthToken(body.link_token);
    } catch (reauthError) {
      pendingOpenRef.current = false;
      setError(reauthError instanceof Error ? reauthError.message : "Re-authentication failed.");
      setBusy(null);
    }
  }, [itemId]);

  async function unlink() {
    if (
      !window.confirm(
        "Unlink this bank? This revokes Plaid access and permanently deletes this connection's " +
          "accounts, transactions, and balance history. This cannot be undone."
      )
    ) {
      return;
    }
    setBusy("unlink");
    setError(null);
    try {
      const response = await fetch(`/api/plaid/items/${itemId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not unlink.");
      router.refresh();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : "Unlink failed.");
      setBusy(null);
    }
  }

  const isSyncing = busy === "sync" || status === "SYNCING";

  return (
    <>
      <Button
        size="sm"
        onClick={sync}
        disabled={Boolean(busy)}
        icon={<RefreshCcw size={11} className={isSyncing ? "spin" : undefined} />}
      >
        Sync
      </Button>
      {status === "ERROR" ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void reauth()}
          disabled={Boolean(busy)}
          icon={<KeyRound size={11} />}
          title="Re-authenticate this bank connection"
        >
          {busy === "reauth" ? "Starting…" : "Re-authenticate"}
        </Button>
      ) : null}
      <Button
        variant="danger"
        size="sm"
        onClick={unlink}
        disabled={Boolean(busy)}
        icon={<Unlink size={11} />}
        title="Unlink and delete this connection"
      >
        Unlink
      </Button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}
