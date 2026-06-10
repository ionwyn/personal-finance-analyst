import {
  ACTIVITY_GROUPS,
  groupOf,
  shortLabel,
  type ActivityGroupKey,
} from "@/lib/investments/activity-types";

export function TypeChip({ type }: { type: string }) {
  const g = ACTIVITY_GROUPS[groupOf(type)];
  return (
    <span className={`type-chip g-${g.key}`} title={`${type} · ${g.name}`}>
      <i className="dot" style={{ background: g.color }} />
      {shortLabel(type)}
    </span>
  );
}

export function TypeChipFilter({
  value,
  onChange,
  counts,
}: {
  value: ActivityGroupKey | null;
  onChange: (v: ActivityGroupKey | null) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="type-filter">
      <button
        type="button"
        className={"tf-chip all " + (!value ? "on" : "")}
        onClick={() => onChange(null)}
      >
        All <span className="ct">{counts.all ?? 0}</span>
      </button>
      {Object.values(ACTIVITY_GROUPS)
        .filter((g) => g.key !== "other")
        .map((g) => (
          <button
            type="button"
            key={g.key}
            className={"tf-chip " + (value === g.key ? "on" : "")}
            onClick={() => onChange(g.key)}
          >
            <i className="dot" style={{ background: g.color }} />
            {g.name}
            <span className="ct">{counts[g.key] ?? 0}</span>
          </button>
        ))}
    </div>
  );
}
