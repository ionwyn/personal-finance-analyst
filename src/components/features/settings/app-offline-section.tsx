"use client";

import { Download, HardDriveDownload, Trash2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Panel, Switch } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import {
  clearOfflineSnapshots,
  listOfflineSnapshotMeta,
  OFFLINE_SNAPSHOTS_ENABLED_KEY,
  offlineSnapshotsEnabled,
  setOfflineSnapshotsEnabled,
  type OfflineSnapshotMeta,
} from "@/lib/pwa/offline-snapshots";

import styles from "./settings.module.scss";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <div className={styles.rowTitle}>{title}</div>
        {desc ? <div className={styles.rowDesc}>{desc}</div> : null}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

export function AppOfflineSection() {
  const [standalone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches
  );
  const [swState, setSwState] = useState(() =>
    typeof navigator !== "undefined" && "serviceWorker" in navigator ? "Checking" : "Unsupported"
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [snapshotsEnabled, setSnapshotsEnabled] = useState(
    () => typeof window !== "undefined" && offlineSnapshotsEnabled()
  );
  const [snapshotMeta, setSnapshotMeta] = useState<OfflineSnapshotMeta[]>([]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          setSwState(registration.active ? "Ready" : "Registered");
        })
        .catch(() => setSwState("Unavailable"));
    }

    void refreshSnapshotMeta();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function refreshSnapshotMeta() {
    try {
      setSnapshotMeta(await listOfflineSnapshotMeta());
    } catch {
      setSnapshotMeta([]);
    }
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function toggleSnapshots(enabled: boolean) {
    setOfflineSnapshotsEnabled(enabled);
    setSnapshotsEnabled(enabled);
    window.dispatchEvent(new StorageEvent("storage", { key: OFFLINE_SNAPSHOTS_ENABLED_KEY }));
  }

  async function clear() {
    await clearOfflineSnapshots();
    await refreshSnapshotMeta();
  }

  const latest = snapshotMeta
    .map((meta) => meta.savedAt)
    .sort()
    .pop();

  return (
    <div className={styles.stack}>
      <Panel title="Install" meta={standalone ? "STANDALONE" : "BROWSER"}>
        <Row
          title="Desktop and mobile install"
          desc="Chromium browsers can show an install prompt here. On iOS, use Safari's Add to Home Screen action."
        >
          <Button
            variant="primary"
            onClick={install}
            disabled={standalone || !installPrompt}
            icon={<Download size={12} />}
          >
            Install
          </Button>
        </Row>
        <Row
          title="Service worker"
          desc="Handles app install assets and the offline fallback page."
        >
          <span className="status idle">
            <i className="pulse" />
            {swState}
          </span>
        </Row>
      </Panel>

      <Panel title="Offline snapshots" meta={snapshotsEnabled ? "LOCAL · ENABLED" : "LOCAL · OFF"}>
        <Row
          title="Save read-only snapshots"
          desc="Stores dashboard, holdings, and calendar summaries in this browser only. No provider tokens or API responses are cached."
        >
          <Switch isSelected={snapshotsEnabled} onChange={toggleSnapshots}>
            {snapshotsEnabled ? "Enabled" : "Disabled"}
          </Switch>
        </Row>
        <Row
          title="Saved data"
          desc={
            latest
              ? `Last saved ${formatRelativeTime(latest)}`
              : "No snapshots saved on this device."
          }
        >
          <Button onClick={clear} disabled={snapshotMeta.length === 0} icon={<Trash2 size={12} />}>
            Clear offline data
          </Button>
        </Row>
        {snapshotMeta.length ? (
          <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
            {snapshotMeta.map((meta) => (
              <div key={meta.kind} className="foot-note" style={{ margin: 0 }}>
                <span>{meta.kind}</span>
                <span>{formatRelativeTime(meta.savedAt)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel title="Notifications" meta="PLANNED">
        <Row
          title="Native alerts"
          desc="Future work: sync failures, Plaid re-auth, budget thresholds, upcoming bills, and watchlist events."
        >
          <span className="status idle">
            <WifiOff size={11} />
            Not wired
          </span>
        </Row>
        <Row
          title="Desktop app compatibility"
          desc="The same local snapshot boundaries can be reused by a future Electron shell."
        >
          <span className="status success">
            <HardDriveDownload size={11} />
            Compatible
          </span>
        </Row>
      </Panel>
    </div>
  );
}
