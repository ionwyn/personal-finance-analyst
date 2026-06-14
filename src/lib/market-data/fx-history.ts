import { logger, safeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import type { HistoricalDateRange } from "./types";

const SERIES_ID = "BOC_FXUSDCAD";
const TTL_MS = 4 * 60 * 60 * 1000;
const EDGE_TOLERANCE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HistoricalFxPoint = {
  date: string;
  rate: number;
};

function dateTime(date: string): number {
  const time = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)) {
    throw new Error(`Invalid historical FX date: ${date}`);
  }
  return time;
}

function withinDays(left: string, right: string, days: number): boolean {
  return Math.abs(dateTime(left) - dateTime(right)) <= days * DAY_MS;
}

async function fetchBankOfCanada(range: HistoricalDateRange): Promise<HistoricalFxPoint[]> {
  const url = new URL("https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json");
  url.searchParams.set("start_date", range.startDate);
  url.searchParams.set("end_date", range.endDate);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Bank of Canada returned HTTP ${response.status} for FXUSDCAD`);
  }

  const body = (await response.json()) as {
    observations?: Array<{ d?: string; FXUSDCAD?: { v?: string } }>;
  };
  return (body.observations ?? [])
    .map((observation) => ({
      date: observation.d ?? "",
      rate: Number(observation.FXUSDCAD?.v),
    }))
    .filter(
      (observation) =>
        /^\d{4}-\d{2}-\d{2}$/.test(observation.date) &&
        Number.isFinite(observation.rate) &&
        observation.rate > 0
    )
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function cachedFx(range: HistoricalDateRange) {
  return prisma.macroPoint.findMany({
    where: {
      seriesId: SERIES_ID,
      date: { gte: range.startDate, lte: range.endDate },
    },
    orderBy: { date: "asc" },
  });
}

export async function getHistoricalUsdCad(
  range: HistoricalDateRange
): Promise<HistoricalFxPoint[]> {
  dateTime(range.startDate);
  dateTime(range.endDate);
  if (range.endDate < range.startDate) {
    throw new Error("Historical FX end date must not precede start date");
  }

  let rows = await cachedFx(range);
  const oldest = rows[0];
  const newest = rows.at(-1);
  const coversStart = oldest && withinDays(oldest.date, range.startDate, EDGE_TOLERANCE_DAYS);
  const coversEnd = newest && withinDays(newest.date, range.endDate, EDGE_TOLERANCE_DAYS);
  const fresh = newest && Date.now() - newest.fetchedAt.getTime() < TTL_MS;

  if (!coversStart || !coversEnd || !fresh) {
    try {
      const points = await fetchBankOfCanada(range);
      if (points.length > 0) {
        const fetchedAt = new Date();
        for (let offset = 0; offset < points.length; offset += 250) {
          const batch = points.slice(offset, offset + 250);
          await prisma.$transaction(
            batch.map((point) =>
              prisma.macroPoint.upsert({
                where: {
                  seriesId_date: { seriesId: SERIES_ID, date: point.date },
                },
                create: {
                  seriesId: SERIES_ID,
                  date: point.date,
                  value: point.rate,
                  fetchedAt,
                },
                update: { value: point.rate, fetchedAt },
              })
            )
          );
        }
        rows = await cachedFx(range);
      }
    } catch (error) {
      logger.warn({ error: safeError(error) }, "historical USD/CAD refresh failed");
    }
  }

  return rows.map((row) => ({ date: row.date, rate: row.value.toNumber() }));
}
