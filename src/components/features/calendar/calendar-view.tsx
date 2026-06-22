"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { OfflineSnapshotWriter } from "@/components/pwa/offline-snapshot-writer";
import { Button, IconButton, PageHeader } from "@/components/ui";
import type { CalendarData } from "@/lib/calendar/get-calendar-events";
import { CALENDAR_CATEGORIES, CATEGORY_META, type CalendarCategory } from "@/lib/calendar/types";

import { CategoryFilter } from "./calendar-parts/category-filter";
import { DayDetail } from "./calendar-parts/day-detail";
import {
  buildWeeks,
  categoryColorVar,
  monthLabel,
  shiftMonth,
  WEEKDAYS,
} from "./calendar-parts/shared";

const MAX_CHIPS = 3;

export function CalendarView({ data }: { data: CalendarData }) {
  const [month, setMonth] = useState(data.navigable.current);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<CalendarCategory>>(
    () =>
      new Set(
        CALENDAR_CATEGORIES.filter(
          (c) => !data.disabledCategories.includes(c) && CATEGORY_META[c].defaultVisible
        )
      )
  );

  const available = useMemo(
    () =>
      CALENDAR_CATEGORIES.filter(
        (c) => !data.disabledCategories.includes(c) && data.counts[c] > 0
      ).map((category) => ({ category, count: data.counts[category] })),
    [data]
  );

  const weeks = useMemo(() => buildWeeks(month), [month]);

  const atMin = month <= data.navigable.min;
  const atMax = month >= data.navigable.max;
  const isCurrent = month === data.navigable.current;

  function toggleCategory(category: CalendarCategory) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const eventsFor = (iso: string) =>
    (data.eventsByDay[iso] ?? []).filter((e) => visible.has(e.category));

  const selectedEvents = selectedDate ? eventsFor(selectedDate) : [];

  return (
    <div className="cal-root">
      <OfflineSnapshotWriter kind="calendar" data={data} />
      <PageHeader
        title="Calendar"
        subtitle={
          <span className="cal-subtitle">
            <span>{monthLabel(month)}</span>
            {data.confirmedThrough ? (
              <span className="cal-confirmed">
                Schedules confirmed through {data.confirmedThrough}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <div className="cal-nav">
              <IconButton
                label="Previous month"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                disabled={atMin}
              >
                <ChevronLeft size={14} />
              </IconButton>
              <Button
                size="sm"
                onClick={() => setMonth(data.navigable.current)}
                disabled={isCurrent}
              >
                Today
              </Button>
              <IconButton
                label="Next month"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                disabled={atMax}
              >
                <ChevronRight size={14} />
              </IconButton>
            </div>
            <Link
              href={"/app/settings?s=calendar" as never}
              className="btn btn-sm"
              prefetch={false}
            >
              <Settings2 size={13} /> Calendar settings
            </Link>
          </>
        }
      />

      <CategoryFilter available={available} visible={visible} onToggle={toggleCategory} />

      <div className="cal-grid-wrap">
        <div className="cal-weekrow cal-weekhead">
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-weekday">
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="cal-weekrow">
            {week.map((cell) => {
              const dayEvents = eventsFor(cell.iso);
              const shown = dayEvents.slice(0, MAX_CHIPS);
              const overflow = dayEvents.length - shown.length;
              const isToday = cell.iso === data.todayISO;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={clsx(
                    "cal-cell",
                    !cell.inMonth && "cal-cell-out",
                    isToday && "cal-cell-today",
                    selectedDate === cell.iso && "cal-cell-sel"
                  )}
                  onClick={() => setSelectedDate(cell.iso)}
                >
                  <span className="cal-daynum">{cell.day}</span>
                  <span className="cal-events">
                    {shown.map((e) => (
                      <span
                        key={e.id}
                        className="cal-ev"
                        data-past={e.isPast || undefined}
                        style={{ ["--cal-cat" as string]: categoryColorVar(e.category) }}
                        title={e.title}
                      >
                        <span className="cal-ev-dot" />
                        <span className="cal-ev-label">{e.title}</span>
                      </span>
                    ))}
                    {overflow > 0 ? <span className="cal-more">+{overflow} more</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selectedDate ? (
        <DayDetail
          date={selectedDate}
          events={selectedEvents}
          onClose={() => setSelectedDate(null)}
        />
      ) : null}

      <p className="cal-foot">
        Projected from your own data and cached public sources — a read-only view, never edited
        back.
      </p>
    </div>
  );
}
