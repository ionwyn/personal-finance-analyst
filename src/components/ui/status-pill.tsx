export function StatusPill({ status }: { status: string }) {
  if (status === "IDLE") return null;
  const cls = status === "SYNCING" ? "syncing" : "error";
  return (
    <span className={`status ${cls}`}>
      <i className="pulse" />
      {status}
    </span>
  );
}
