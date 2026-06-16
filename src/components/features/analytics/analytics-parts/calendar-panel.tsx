import Link from "next/link";

import type { CalendarEntry } from "@/lib/investments/analytics-loader";

// ─── Upcoming corporate calendar across the book ───────────────────────────

const KIND_LABEL: Record<CalendarEntry["kind"], string> = {
  earnings: "EARNINGS",
  "ex-dividend": "EX-DIV",
  "dividend-pay": "DIV PAID",
};

const KIND_COLOR: Record<CalendarEntry["kind"], string> = {
  earnings: "var(--invest)",
  "ex-dividend": "var(--accent)",
  "dividend-pay": "var(--pos)",
};

function dayLabel(iso: string): { d: string; soon: boolean } {
  const t = new Date(iso);
  const days = Math.round((t.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return {
    d: t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    soon: days >= 0 && days <= 7,
  };
}

export function CalendarPanel({ calendar }: { calendar: CalendarEntry[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Upcoming · my holdings</div>
        <div className="panel-meta">NEXT 60 DAYS · TOP POSITIONS</div>
      </div>
      <div className="panel-body flush">
        {calendar.length === 0 ? (
          <div className="mkt-empty" style={{ padding: "18px 14px" }}>
            No earnings or dividend dates published for your top holdings in the next 60 days.
          </div>
        ) : (
          <div className="ana-cal-list">
            {calendar.slice(0, 10).map((c, i) => {
              const { d, soon } = dayLabel(c.date);
              return (
                <Link
                  key={i}
                  href={`/app/portfolio/${encodeURIComponent(c.symbol)}` as never}
                  className={"ana-cal-row " + (soon ? "soon" : "")}
                >
                  <span className="date">{d}</span>
                  <span className="kind" style={{ color: KIND_COLOR[c.kind] }}>
                    {KIND_LABEL[c.kind]}
                  </span>
                  <span className="sym">{c.symbol}</span>
                  <span className="nm">{c.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
