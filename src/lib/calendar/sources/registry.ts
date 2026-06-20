// ─── Calendar source registry ───────────────────────────────────────────────
// The single list of every event source the aggregator runs. Order here is the
// default render order within a day.

import { BOC_SCHEDULE, FOMC_SCHEDULE, STATCAN_SCHEDULE } from "@/lib/calendar/rules/schedules";
import { earningsDividendsSource } from "@/lib/calendar/sources/earnings-dividends";
import { fredReleasesSource } from "@/lib/calendar/sources/fred-releases";
import { paychecksSource } from "@/lib/calendar/sources/paychecks";
import { recurringBillsSource } from "@/lib/calendar/sources/recurring-bills";
import { savingsGoalsSource } from "@/lib/calendar/sources/savings-goals";
import { savingsTransfersSource } from "@/lib/calendar/sources/savings-transfers";
import { scheduleSource } from "@/lib/calendar/sources/schedule-source";
import { settlementsSource } from "@/lib/calendar/sources/settlements";
import { taxCaSource, taxSlipsSource, taxUsSource } from "@/lib/calendar/sources/tax";
import { usFilingsSource } from "@/lib/calendar/sources/us-filings";
import type { CalendarSource } from "@/lib/calendar/types";

export const CALENDAR_SOURCES: CalendarSource[] = [
  // Personal Finance
  paychecksSource,
  recurringBillsSource,
  savingsGoalsSource,
  settlementsSource,
  savingsTransfersSource,
  // Investments
  earningsDividendsSource,
  // Filings
  usFilingsSource,
  // Macro · US
  fredReleasesSource,
  scheduleSource(FOMC_SCHEDULE),
  // Macro · Canada
  scheduleSource(BOC_SCHEDULE),
  scheduleSource(STATCAN_SCHEDULE),
  // Tax
  taxCaSource,
  taxUsSource,
  taxSlipsSource,
];
