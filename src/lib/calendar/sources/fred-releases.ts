// ─── Source: US macro release dates (Macro · US) ────────────────────────────
// Forward release calendar from FRED's fred/release/dates endpoint, cached in
// MacroReleaseDate with the same cache-while-fresh discipline as macro.ts.
// Free with the existing FRED key; ~6 months of forward dates are published.

import { isWithinRange } from "@/lib/calendar/dates";
import type { CalendarEvent, CalendarSource } from "@/lib/calendar/types";
import { getFredApiKey } from "@/lib/env";
import { logger, safeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const RELEASE_TTL_MS = 12 * 60 * 60 * 1000;

const RELEASES: { id: string; type: string; title: string }[] = [
  { id: "10", type: "us-cpi", title: "US CPI release" },
  { id: "50", type: "us-jobs", title: "US jobs report" },
  { id: "53", type: "us-gdp", title: "US GDP release" },
];

/** Most recent + scheduled-future release dates for a FRED release. Sorted
 *  desc & capped: the upcoming dates sort to the top, comfortably covering the
 *  9-month window without pulling decades of history. */
async function fetchReleaseDates(releaseId: string): Promise<string[]> {
  const url = new URL("https://api.stlouisfed.org/fred/release/dates");
  url.searchParams.set("release_id", releaseId);
  url.searchParams.set("api_key", getFredApiKey());
  url.searchParams.set("file_type", "json");
  url.searchParams.set("include_release_dates_with_no_data", "true");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "24");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`FRED returned HTTP ${res.status} for release ${releaseId}.`);
  const body = (await res.json()) as { release_dates?: { date: string }[] };
  return (body.release_dates ?? []).map((r) => r.date).filter(Boolean);
}

/** Cached release dates for one release, refreshing from FRED when stale. */
async function ensureReleaseDates(releaseId: string): Promise<string[]> {
  const rows = await prisma.macroReleaseDate.findMany({ where: { releaseId } });
  const newest = rows.reduce((max, r) => Math.max(max, r.fetchedAt.getTime()), 0);
  const fresh = rows.length > 0 && Date.now() - newest < RELEASE_TTL_MS;
  if (fresh) return rows.map((r) => r.date);

  try {
    const dates = await fetchReleaseDates(releaseId);
    if (dates.length > 0) {
      await prisma.$transaction([
        prisma.macroReleaseDate.deleteMany({ where: { releaseId } }),
        prisma.macroReleaseDate.createMany({
          data: dates.map((date) => ({ releaseId, date })),
          skipDuplicates: true,
        }),
      ]);
      return dates;
    }
  } catch (error) {
    logger.warn({ releaseId, error: safeError(error) }, "FRED release dates refresh failed");
  }
  return rows.map((r) => r.date);
}

export const fredReleasesSource: CalendarSource = {
  id: "fred-releases",
  category: "macro-us",
  label: "US economic releases",

  async getEvents({ range }): Promise<CalendarEvent[]> {
    const perRelease = await Promise.all(
      RELEASES.map(async (rel) => {
        const dates = await ensureReleaseDates(rel.id);
        return dates
          .filter((date) => isWithinRange(date, range.start, range.end))
          .map<CalendarEvent>((date) => ({
            id: `fred-${rel.id}:${date}`,
            date,
            category: "macro-us",
            type: rel.type,
            title: rel.title,
            confidence: "scheduled",
            isPast: false,
            source: "FRED release calendar",
          }));
      })
    );
    return perRelease.flat();
  },

  async listItems() {
    return RELEASES.map((r) => ({ key: `fred-${r.id}`, label: r.title }));
  },
};
