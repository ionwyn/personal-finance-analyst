-- AlterTable
ALTER TABLE "SnapTradeAccount" ADD COLUMN     "activitiesBackfilledAt" TIMESTAMP(3),
ADD COLUMN     "lastActivityDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SnapTradeSyncRun" ADD COLUMN     "activitiesCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SnapTradeActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "snapTradeActivityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT,
    "description" TEXT,
    "units" DECIMAL(24,8),
    "price" DECIMAL(24,8),
    "amount" DECIMAL(24,8),
    "fee" DECIMAL(24,8),
    "currency" TEXT NOT NULL,
    "fxRate" DECIMAL(18,8),
    "tradeDate" TIMESTAMP(3),
    "settlementDate" TIMESTAMP(3),
    "externalReferenceId" TEXT,
    "institution" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnapTradeActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SnapTradeActivity_snapTradeActivityId_key" ON "SnapTradeActivity"("snapTradeActivityId");

-- CreateIndex
CREATE INDEX "SnapTradeActivity_tenantId_tradeDate_idx" ON "SnapTradeActivity"("tenantId", "tradeDate");

-- CreateIndex
CREATE INDEX "SnapTradeActivity_accountId_tradeDate_idx" ON "SnapTradeActivity"("accountId", "tradeDate");

-- CreateIndex
CREATE INDEX "SnapTradeActivity_symbol_idx" ON "SnapTradeActivity"("symbol");

-- CreateIndex
CREATE INDEX "SnapTradeActivity_type_idx" ON "SnapTradeActivity"("type");

-- CreateIndex
CREATE INDEX "SnapTradeActivity_externalReferenceId_idx" ON "SnapTradeActivity"("externalReferenceId");

-- AddForeignKey
ALTER TABLE "SnapTradeActivity" ADD CONSTRAINT "SnapTradeActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapTradeActivity" ADD CONSTRAINT "SnapTradeActivity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SnapTradeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
