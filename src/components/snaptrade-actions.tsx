"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Unlink } from "lucide-react";

export function SnapTradeLinkButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/snaptrade/login", { method: "POST" });
      if (!response.ok) throw new Error("Could not start SnapTrade connection.");
      const body = (await response.json()) as { redirectURI?: string };
      if (!body.redirectURI) throw new Error("SnapTrade did not return a connection URL.");
      window.location.href = body.redirectURI;
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "SnapTrade Link failed.");
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={start} disabled={busy}>
        {busy ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
        {compact ? "Add brokerage" : "Link brokerage"}
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}

export function SnapTradeSyncButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/snaptrade/sync", { method: "POST" });
      if (!response.ok) throw new Error("Could not sync SnapTrade data.");
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "SnapTrade sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn" type="button" onClick={sync} disabled={busy}>
        <RefreshCw size={compact ? 11 : 12} className={busy ? "spin" : undefined} />
        {busy ? "Syncing..." : "Sync"}
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}

export function SnapTradeConnectionActions({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"sync" | "refresh" | "unlink" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "sync" | "refresh" | "unlink") {
    if (action === "unlink" && !window.confirm("Unlink this SnapTrade brokerage connection?")) {
      return;
    }

    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(
        action === "sync"
          ? "/api/snaptrade/sync"
          : action === "refresh"
            ? `/api/snaptrade/connections/${connectionId}/refresh`
            : `/api/snaptrade/connections/${connectionId}`,
        { method: action === "unlink" ? "DELETE" : "POST" }
      );
      if (!response.ok) throw new Error(`Could not ${action} SnapTrade connection.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "SnapTrade action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => run("sync")}
        disabled={Boolean(busyAction)}
      >
        <RefreshCw size={11} className={busyAction === "sync" ? "spin" : undefined} />
        Sync
      </button>
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => run("refresh")}
        disabled={Boolean(busyAction)}
      >
        Refresh
      </button>
      <button
        className="btn btn-sm btn-danger"
        type="button"
        onClick={() => run("unlink")}
        disabled={Boolean(busyAction)}
      >
        <Unlink size={11} />
        Unlink
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}
