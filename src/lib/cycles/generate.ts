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
 * paycheck date. Cycles are `lengthDays` long (default 14), repeating forward
 * and backward from the anchor. Only fixed-length strides are supported here —
 * semi-monthly / monthly frequencies need a different model (see
 * SETTINGS_IMPLEMENTATION.md, Phase 1 "Impossible without overhaul").
 */
export function cycleStartForDate(
  anchor: Date,
  date: Date,
  lengthDays: number = CYCLE_LENGTH_DAYS
) {
  const anchorDay = startOfUtcDay(anchor);
  const targetDay = startOfUtcDay(date);
  const delta = diffDays(targetDay, anchorDay);
  // floor toward negative infinity so dates before the anchor still land on a stride boundary
  const stride = Math.floor(delta / lengthDays);
  return addDays(anchorDay, stride * lengthDays);
}

export function cycleEndForStart(start: Date, lengthDays: number = CYCLE_LENGTH_DAYS) {
  return addDays(start, lengthDays - 1);
}

export async function generatePayCycles(
  tenantId: string,
  anchor: Date,
  options: {
    backMonths?: number;
    forwardMonths?: number;
    client?: Client;
    lengthDays?: number;
  } = {}
) {
  const client = options.client ?? prisma;
  const backMonths = options.backMonths ?? DEFAULT_BACK_MONTHS;
  const forwardMonths = options.forwardMonths ?? DEFAULT_FORWARD_MONTHS;

  let lengthDays = options.lengthDays;
  if (lengthDays == null) {
    const settings = await client.userSettings.findUnique({
      where: { tenantId },
      select: { payFrequencyDays: true },
    });
    lengthDays = settings?.payFrequencyDays ?? CYCLE_LENGTH_DAYS;
  }

  const anchorStart = startOfUtcDay(anchor);
  const rangeStart = startOfUtcDay(new Date(anchorStart));
  rangeStart.setUTCMonth(rangeStart.getUTCMonth() - backMonths);
  const rangeEnd = startOfUtcDay(new Date(anchorStart));
  rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + forwardMonths);

  const firstStart = cycleStartForDate(anchorStart, rangeStart, lengthDays);
  const created: PayCycle[] = [];

  for (let start = firstStart; start <= rangeEnd; start = addDays(start, lengthDays)) {
    const end = cycleEndForStart(start, lengthDays);
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
  options: { client?: Client; anchor?: Date | null; lengthDays?: number } = {}
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
    options.anchor === undefined || options.lengthDays == null
      ? await client.userSettings.findUnique({
          where: { tenantId },
          select: { lastPaycheckDate: true, payFrequencyDays: true },
        })
      : null;
  const anchor = options.anchor ?? settings?.lastPaycheckDate ?? target;
  const lengthDays = options.lengthDays ?? settings?.payFrequencyDays ?? CYCLE_LENGTH_DAYS;

  const start = cycleStartForDate(anchor, target, lengthDays);
  const end = cycleEndForStart(start, lengthDays);
  return client.payCycle.upsert({
    where: { tenantId_startDate: { tenantId, startDate: start } },
    update: { endDate: end },
    create: { tenantId, startDate: start, endDate: end },
  });
}
