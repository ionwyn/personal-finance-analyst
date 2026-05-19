export function StatusPill({ status }: { status: string }) {
  const cls = status === "SYNCING" ? "syncing" : status === "ERROR" ? "error" : "idle";
  return (
    <span className={`status ${cls}`}>
      <i className="pulse" />
      {status}
    </span>
  );
}
