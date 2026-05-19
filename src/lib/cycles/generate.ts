import type { PayCycle, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const CYCLE_LENGTH_DAYS = 14;
export const DEFAULT_BACK_MONTHS = 6;
export const DEFAULT_FORWARD_MONTHS = 3;

type Client = PrismaClient | Prisma.TransactionClient;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDays(a: Date, b: Date) {
  const ms = startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Compute the canonical cycle start date that covers `date` given an anchor
 * paycheck date. Cycles are 14 days long, repeating forward and backward from
 * the anchor.
 */
export function cycleStartForDate(anchor: Date, date: Date) {
  const anchorDay = startOfUtcDay(anchor);
  const targetDay = startOfUtcDay(date);
  const delta = diffDays(targetDay, anchorDay);
  // floor toward negative infinity so dates before the anchor still land on a stride boundary
  const stride = Math.floor(delta / CYCLE_LENGTH_DAYS);
  return addDays(anchorDay, stride * CYCLE_LENGTH_DAYS);
}

export function cycleEndForStart(start: Date) {
  return addDays(start, CYCLE_LENGTH_DAYS - 1);
}

export async function generatePayCycles(
  tenantId: string,
  anchor: Date,
  options: { backMonths?: number; forwardMonths?: number; client?: Client } = {}
) {
  const client = options.client ?? prisma;
  const backMonths = options.backMonths ?? DEFAULT_BACK_MONTHS;
  const forwardMonths = options.forwardMonths ?? DEFAULT_FORWARD_MONTHS;

  const anchorStart = startOfUtcDay(anchor);
  const rangeStart = startOfUtcDay(new Date(anchorStart));
  rangeStart.setUTCMonth(rangeStart.getUTCMonth() - backMonths);
  const rangeEnd = startOfUtcDay(new Date(anchorStart));
  rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + forwardMonths);

  const firstStart = cycleStartForDate(anchorStart, rangeStart);
  const created: PayCycle[] = [];

  for (let start = firstStart; start <= rangeEnd; start = addDays(start, CYCLE_LENGTH_DAYS)) {
    const end = cycleEndForStart(start);
    const upserted = await client.payCycle.upsert({
      where: { tenantId_startDate: { tenantId, startDate: start } },
      update: { endDate: end },
      create: { tenantId, startDate: start, endDate: end },
    });
    created.push(upserted);
  }

  return created;
}

/**
 * Resolve (or create) the PayCycle that contains `date` for the given tenant.
 * Falls back gracefully when no anchor is configured: in that case we derive an
 * anchor from the date itself so existing transactions can still be bound to a
 * cycle.
 */
export async function ensureCycleForDate(
  tenantId: string,
  date: Date,
  options: { client?: Client; anchor?: Date | null } = {}
) {
  const client = options.client ?? prisma;
  const target = startOfUtcDay(date);

  const existing = await client.payCycle.findFirst({
    where: {
      tenantId,
      startDate: { lte: target },
      endDate: { gte: target },
    },
  });
  if (existing) return existing;

  const settings =
    options.anchor === undefined
      ? await client.userSettings.findUnique({ where: { tenantId } })
      : null;
  const anchor = options.anchor ?? settings?.lastPaycheckDate ?? target;

  const start = cycleStartForDate(anchor, target);
  const end = cycleEndForStart(start);
  return client.payCycle.upsert({
    where: { tenantId_startDate: { tenantId, startDate: start } },
    update: { endDate: end },
    create: { tenantId, startDate: start, endDate: end },
  });
}
