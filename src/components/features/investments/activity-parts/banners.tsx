import { formatRelativeTime } from "@/lib/format";

export function SyncBanner({ broker }: { broker: string }) {
  return (
    <div className="act-banner syncing">
      <i className="pulse" />
      <span className="lbl">REFRESHING ACTIVITY FROM {broker.toUpperCase()}</span>
      <span className="meta">Existing rows shown · new activity will appear when complete</span>
    </div>
  );
}

export function ErrorBanner({ code, lastSync }: { code: string | null; lastSync: string | null }) {
  return (
    <div className="act-banner err">
      <i className="dot" />
      <span className="lbl">SYNC FAILED · {code ?? "UNKNOWN"}</span>
      <span className="meta">
        {lastSync
          ? `Last successful sync ${formatRelativeTime(lastSync)} · showing cached data`
          : "No successful sync yet"}
      </span>
    </div>
  );
}

export function NoConnectionCard() {
  return (
    <div className="panel act-no-conn">
      <div className="hd">
        <div>
          <div className="title">No brokerage connected</div>
          <div className="sub">
            Link a brokerage via SnapTrade to start importing buys, sells, dividends, and
            contributions.
          </div>
        </div>
      </div>
      <div className="bd">
        <ul className="bullets">
          <li>Read-only — we never place trades.</li>
          <li>Initial backfill depends on your brokerage; we pull up to 24 months of history.</li>
          <li>Syncs every 6 hours; manual refresh on the Holdings tab.</li>
        </ul>
      </div>
    </div>
  );
}

export function FirstTimeEmpty({ lastSyncAt }: { lastSyncAt: string | null }) {
  return (
    <div className="panel act-empty-panel">
      <div className="emp-title">No activity yet</div>
      <div className="emp-sub">
        Your brokerage is connected but no activity has been pulled in.
        <br />
        Some institutions take up to 24 hours to backfill — try a manual sync, or check again later.
      </div>
      <div className="emp-meta">
        {lastSyncAt ? `Last sync ${formatRelativeTime(lastSyncAt)}` : "No sync recorded yet"}
      </div>
    </div>
  );
}

export function EmptyFilterRow() {
  return (
    <div className="act-empty inline">
      <div className="title">No activity matches these filters</div>
      <div className="sub">
        Try widening the date range, clearing the type chip, or adding more accounts.
      </div>
    </div>
  );
}
