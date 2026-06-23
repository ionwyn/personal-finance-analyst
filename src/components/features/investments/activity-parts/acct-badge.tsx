import { InstitutionLogo } from "@/components/shared/institution-logo";
import type { ActivityRow } from "@/lib/investments/activities-loader";

export function AcctBadge({ row }: { row: ActivityRow }) {
  return (
    <span className="acct-badge dense">
      <InstitutionLogo
        name={row.institution}
        logo={row.institutionLogo}
        bg={row.institutionLogoBg}
        size={20}
        radius={4}
        style={{ display: "inline-block" }}
      />
      <span className="reg">{row.accountLabel}</span>
    </span>
  );
}
