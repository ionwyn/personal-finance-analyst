-- CreateEnum
CREATE TYPE "BrokerLedgerProvider" AS ENUM ('SNAPTRADE', 'WEALTHSIMPLE_CSV');

-- CreateEnum
CREATE TYPE "BrokerLedgerSourceStatus" AS ENUM ('PENDING', 'LINKED', 'CONFLICT', 'IGNORED');

-- CreateEnum
CREATE TYPE "BrokerLedgerIngestionMode" AS ENUM ('SYNC', 'IMPORT', 'MIGRATION');

-- CreateEnum
CREATE TYPE "BrokerLedgerReconciliationStatus" AS ENUM ('UNKNOWN', 'COMPLETE', 'PARTIAL', 'CONFLICT');

-- AlterTable
ALTER TABLE "BrokerLedgerEntry"
ADD COLUMN "nativeCashAmount" DECIMAL(24,10),
ADD COLUMN "nativeCurrency" TEXT,
ADD COLUMN "fxRate" DECIMAL(24,10);

UPDATE "BrokerLedgerEntry"
SET
  "nativeCashAmount" = "cashAmount",
  "nativeCurrency" = CASE WHEN "cashAmount" IS NULL THEN NULL ELSE 'CAD' END,
  "fxRate" = CASE WHEN "cashAmount" IS NULL THEN NULL ELSE 1 END;

-- AlterTable
ALTER TABLE "SnapTradeSyncRun"
ADD COLUMN "canonicalizedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ledgerLinkedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ledgerIgnoredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ledgerConflictCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BrokerLedgerIngestionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "BrokerLedgerProvider" NOT NULL,
    "mode" "BrokerLedgerIngestionMode" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "linkedCount" INTEGER NOT NULL DEFAULT 0,
    "canonicalizedCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "BrokerLedgerIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerLedgerSourceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT,
    "ledgerEntryId" TEXT,
    "ingestionRunId" TEXT,
    "provider" "BrokerLedgerProvider" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "providerRecordId" TEXT,
    "status" "BrokerLedgerSourceStatus" NOT NULL DEFAULT 'PENDING',
    "matchConfidence" DECIMAL(5,4),
    "conflictReason" TEXT,
    "tradeDate" DATE,
    "settlementDate" DATE,
    "activityType" TEXT,
    "activitySubType" TEXT,
    "symbol" TEXT,
    "symbolNorm" TEXT,
    "name" TEXT,
    "currency" TEXT,
    "units" DECIMAL(24,8),
    "unitPrice" DECIMAL(24,10),
    "nativeCashAmount" DECIMAL(24,10),
    "cashAmount" DECIMAL(24,10),
    "fxRate" DECIMAL(24,10),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerLedgerSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerLedgerCoverage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "activityStartDate" DATE,
    "activityEndDate" DATE,
    "taxCoverageStartDate" DATE,
    "reconciliationStatus" "BrokerLedgerReconciliationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "canonicalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerLedgerCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrokerLedgerIngestionRun_tenantId_startedAt_idx" ON "BrokerLedgerIngestionRun"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "BrokerLedgerIngestionRun_provider_status_idx" ON "BrokerLedgerIngestionRun"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerLedgerSourceRecord_tenantId_provider_sourceKey_key" ON "BrokerLedgerSourceRecord"("tenantId", "provider", "sourceKey");

-- CreateIndex
CREATE INDEX "BrokerLedgerSourceRecord_tenantId_status_idx" ON "BrokerLedgerSourceRecord"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BrokerLedgerSourceRecord_accountId_tradeDate_idx" ON "BrokerLedgerSourceRecord"("accountId", "tradeDate");

-- CreateIndex
CREATE INDEX "BrokerLedgerSourceRecord_ledgerEntryId_idx" ON "BrokerLedgerSourceRecord"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "BrokerLedgerSourceRecord_ingestionRunId_idx" ON "BrokerLedgerSourceRecord"("ingestionRunId");

-- CreateIndex
CREATE INDEX "BrokerLedgerSourceRecord_provider_providerRecordId_idx" ON "BrokerLedgerSourceRecord"("provider", "providerRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerLedgerCoverage_accountId_key" ON "BrokerLedgerCoverage"("accountId");

-- CreateIndex
CREATE INDEX "BrokerLedgerCoverage_tenantId_reconciliationStatus_idx" ON "BrokerLedgerCoverage"("tenantId", "reconciliationStatus");

-- AddForeignKey
ALTER TABLE "BrokerLedgerIngestionRun" ADD CONSTRAINT "BrokerLedgerIngestionRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerLedgerSourceRecord" ADD CONSTRAINT "BrokerLedgerSourceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerLedgerSourceRecord" ADD CONSTRAINT "BrokerLedgerSourceRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SnapTradeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerLedgerSourceRecord" ADD CONSTRAINT "BrokerLedgerSourceRecord_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "BrokerLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerLedgerSourceRecord" ADD CONSTRAINT "BrokerLedgerSourceRecord_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "BrokerLedgerIngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerLedgerCoverage" ADD CONSTRAINT "BrokerLedgerCoverage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerLedgerCoverage" ADD CONSTRAINT "BrokerLedgerCoverage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SnapTradeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
