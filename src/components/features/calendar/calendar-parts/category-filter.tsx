"use client";

import clsx from "clsx";

import { CATEGORY_META, type CalendarCategory } from "@/lib/calendar/types";

import { categoryColorVar } from "./shared";

export function CategoryFilter({
  available,
  visible,
  onToggle,
}: {
  available: { category: CalendarCategory; count: number }[];
  visible: Set<CalendarCategory>;
  onToggle: (category: CalendarCategory) => void;
}) {
  if (available.length === 0) return null;
  return (
    <div className="cal-filter" role="group" aria-label="Filter categories">
      {available.map(({ category, count }) => {
        const on = visible.has(category);
        return (
          <button
            key={category}
            type="button"
            aria-pressed={on}
            className={clsx("cal-chip", on && "cal-chip-on")}
            style={{ ["--cal-cat" as string]: categoryColorVar(category) }}
            onClick={() => onToggle(category)}
          >
            <span className="cal-chip-dot" />
            <span className="cal-chip-label">{CATEGORY_META[category].label}</span>
            <span className="cal-chip-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
