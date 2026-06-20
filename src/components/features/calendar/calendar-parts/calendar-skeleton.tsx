import { WEEKDAYS } from "./shared";

/** Loading placeholder shown while the server aggregates the window (cold cache
 *  can hit Yahoo/FRED/EDGAR before warming). Mirrors the grid shape. */
export function CalendarSkeleton() {
  return (
    <div className="cal-root" aria-busy="true">
      <div className="page-header">
        <div>
          <div className="page-title">Calendar</div>
          <div className="page-sub">Loading events…</div>
        </div>
      </div>
      <div className="cal-grid-wrap">
        <div className="cal-weekrow cal-weekhead">
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-weekday">
              {d}
            </div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, w) => (
          <div key={w} className="cal-weekrow">
            {Array.from({ length: 7 }).map((__, d) => (
              <div key={d} className="cal-cell cal-cell-skeleton">
                <span className="skeleton cal-skel-num" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
