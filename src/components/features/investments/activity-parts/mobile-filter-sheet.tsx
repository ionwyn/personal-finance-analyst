import { X } from "lucide-react";

import { ACTIVITY_GROUPS, type ActivityGroupKey } from "@/lib/investments/activity-types";
import type { ActivityAccountOption } from "@/lib/investments/activities-loader";

export function MobileFilterSheet({
  open,
  onClose,
  group,
  setGroup,
  accts,
  setAccts,
  acctOpts,
  counts,
}: {
  open: boolean;
  onClose: () => void;
  group: ActivityGroupKey | null;
  setGroup: (g: ActivityGroupKey | null) => void;
  accts: string[];
  setAccts: (v: string[]) => void;
  acctOpts: ActivityAccountOption[];
  counts: Record<string, number>;
}) {
  if (!open) return null;
  return (
    <div className="act-sheet-scrim" onClick={onClose}>
      <div className="act-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sh-head">
          <div className="sh-title">Filters</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={12} />
          </button>
        </div>
        <div className="sh-section">
          <div className="sh-lbl">Type</div>
          <div className="sh-types">
            <button
              type="button"
              className={"tf-chip all " + (!group ? "on" : "")}
              onClick={() => setGroup(null)}
            >
              All <span className="ct">{counts.all ?? 0}</span>
            </button>
            {Object.values(ACTIVITY_GROUPS)
              .filter((g) => g.key !== "other")
              .map((g) => (
                <button
                  type="button"
                  key={g.key}
                  className={"tf-chip " + (group === g.key ? "on" : "")}
                  onClick={() => setGroup(g.key)}
                >
                  <i className="dot" style={{ background: g.color }} />
                  {g.name} <span className="ct">{counts[g.key] ?? 0}</span>
                </button>
              ))}
          </div>
        </div>
        <div className="sh-section">
          <div className="sh-lbl">Accounts</div>
          {acctOpts.map((o) => {
            const on = accts.length === 0 || accts.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                className={"sh-acct " + (on ? "on" : "")}
                onClick={() => {
                  if (accts.includes(o.id)) setAccts(accts.filter((x) => x !== o.id));
                  else setAccts([...accts, o.id]);
                }}
              >
                <span className="cb">{on ? "✓" : ""}</span>
                {o.institution} · {o.label}
              </button>
            );
          })}
        </div>
        <div className="sh-foot">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setGroup(null);
              setAccts([]);
            }}
          >
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
