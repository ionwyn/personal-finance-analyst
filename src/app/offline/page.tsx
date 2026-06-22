import Link from "next/link";

import { OfflineSnapshotViewer } from "@/components/pwa/offline-snapshot-viewer";
import { Button } from "@/components/ui";

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        justifyItems: "center",
        alignContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <section className="empty-state" style={{ maxWidth: 560 }}>
        <h1>Offline</h1>
        <p>
          WYN Financial could not reach the network. Reconnect to refresh live banking, brokerage,
          and market data.
        </p>
        <Link href={"/app" as never}>
          <Button>Try dashboard</Button>
        </Link>
      </section>
      <OfflineSnapshotViewer />
    </main>
  );
}
