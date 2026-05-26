-- AlterTable: budget alert thresholds + roll-forward preference live on UserSettings
ALTER TABLE "UserSettings" ADD COLUMN "budgetWarnPct" INTEGER NOT NULL DEFAULT 85;
ALTER TABLE "UserSettings" ADD COLUMN "budgetAlarmPct" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "UserSettings" ADD COLUMN "budgetRollForward" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: savings goals gain a start date (paired with targetDate as the end date)
ALTER TABLE "SavingsGoal" ADD COLUMN "startDate" TIMESTAMP(3);
