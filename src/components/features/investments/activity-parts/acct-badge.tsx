import type { ActivityRow } from "@/lib/investments/activities-loader";

export function AcctBadge({ row }: { row: ActivityRow }) {
  return (
    <span className="acct-badge dense">
      <i className="logo" style={{ background: row.institutionLogoBg }}>
        {row.institutionLogoText}
      </i>
      <span className="reg">{row.accountLabel}</span>
    </span>
  );
}
