import { Suspense } from "react";

import { CalendarView } from "@/components/features/calendar/calendar-view";
import { CalendarSkeleton } from "@/components/features/calendar/calendar-parts/calendar-skeleton";
import { getCalendarEvents } from "@/lib/calendar/get-calendar-events";
import { getSessionTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarLoader />
    </Suspense>
  );
}

async function CalendarLoader() {
  const { tenantId } = await getSessionTenant();
  if (!tenantId) {
    return (
      <section className="empty-state">
        <h2>No tenant found</h2>
      </section>
    );
  }

  const data = await getCalendarEvents(tenantId);
  return <CalendarView data={data} />;
}
