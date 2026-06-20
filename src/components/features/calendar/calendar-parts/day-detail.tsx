"use client";

import { X } from "lucide-react";

import { IconButton } from "@/components/ui";
import type { CalendarEvent } from "@/lib/calendar/types";
import { formatMoney } from "@/lib/format";

import { categoryColorVar, CONFIDENCE_LABEL, dayLabel, sortDayEvents } from "./shared";

export function DayDetail({
  date,
  events,
  onClose,
}: {
  date: string;
  events: CalendarEvent[];
  onClose: () => void;
}) {
  const sorted = sortDayEvents(events);
  return (
    <div className="cal-detail">
      <div className="cal-detail-head">
        <div className="cal-detail-title">{dayLabel(date)}</div>
        <IconButton label="Close" onClick={onClose}>
          <X size={13} />
        </IconButton>
      </div>

      {sorted.length === 0 ? (
        <div className="cal-detail-empty">No events on this day.</div>
      ) : (
        <ul className="cal-detail-list">
          {sorted.map((e) => {
            const tag = CONFIDENCE_LABEL[e.confidence];
            return (
              <li key={e.id} className="cal-detail-item" data-past={e.isPast || undefined}>
                <span
                  className="cal-detail-dot"
                  style={{ ["--cal-cat" as string]: categoryColorVar(e.category) }}
                />
                <div className="cal-detail-body">
                  <div className="cal-detail-name">
                    {e.title}
                    {tag ? <span className="cal-detail-tag">{tag}</span> : null}
                  </div>
                  {e.subtitle ? <div className="cal-detail-sub">{e.subtitle}</div> : null}
                  <div className="cal-detail-meta">
                    {e.endDate && e.endDate !== e.date ? `Through ${e.endDate} · ` : null}
                    {e.source}
                  </div>
                </div>
                {typeof e.amount === "number" ? (
                  <div className="cal-detail-amt">{formatMoney(e.amount, { ccy: true })}</div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
