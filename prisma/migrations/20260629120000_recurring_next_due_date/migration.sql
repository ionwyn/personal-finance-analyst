-- Replace the day-of-month `anchorDate` with a full `nextDueDate` so occurrences
-- (including annual month-of-year and weekly/biweekly phase) can be projected.

-- AlterTable: add the new column
ALTER TABLE "RecurringExpense" ADD COLUMN "nextDueDate" TIMESTAMP(3);

-- Backfill (1): linked Plaid streams carry a full predicted next date — best source,
-- and the only source that recovers a month-of-year for annual bills.
UPDATE "RecurringExpense" re
SET "nextDueDate" = prs."predictedNextDate"
FROM "PlaidRecurringStream" prs
WHERE re."plaidStreamId" = prs."streamId"
  AND prs."predictedNextDate" IS NOT NULL
  AND re."nextDueDate" IS NULL;

-- Backfill (2): monthly bills with a day-of-month anchor — seed this month on that
-- day (clamped to month length). Monthly projection steps from here, so only the
-- day-of-month matters; the seed month/year is irrelevant.
UPDATE "RecurringExpense"
SET "nextDueDate" = make_date(
      date_part('year', CURRENT_DATE)::int,
      date_part('month', CURRENT_DATE)::int,
      LEAST(
        "anchorDate",
        date_part('day', (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day'))::int
      )
    )
WHERE "frequency" = 'monthly'
  AND "anchorDate" IS NOT NULL
  AND "nextDueDate" IS NULL;

-- Everything else (annual without a Plaid date, weekly/biweekly without a Plaid
-- date) is left null and degrades to the flat accrualPerCycle slice until the
-- user sets a date in Settings. Weekly/biweekly fallback already equals the
-- correct reservation, so only annual loses the due-date spike until set.

-- AlterTable: drop the superseded column
ALTER TABLE "RecurringExpense" DROP COLUMN "anchorDate";
