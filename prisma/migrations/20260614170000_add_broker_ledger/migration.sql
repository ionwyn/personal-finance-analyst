-- CreateTable
CREATE TABLE "BrokerLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT,
    "accountExternalId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "tradeDate" DATE NOT NULL,
    "settlementDate" DATE,
    "activityType" TEXT NOT NULL,
    "activitySubType" TEXT,
    "symbol" TEXT,
    "symbolNorm" TEXT,
    "name" TEXT,
    "currency" TEXT,
    "units" DECIMAL(24,8) NOT NULL,
    "unitPrice" DECIMAL(24,10),
    "cashAmount" DECIMAL(24,10),
    "dedupeKey" TEXT NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerLedgerEntry_dedupeKey_key" ON "BrokerLedgerEntry"("dedupeKey");

-- CreateIndex
CREATE INDEX "BrokerLedgerEntry_tenantId_tradeDate_idx" ON "BrokerLedgerEntry"("tenantId", "tradeDate");

-- CreateIndex
CREATE INDEX "BrokerLedgerEntry_tenantId_symbolNorm_idx" ON "BrokerLedgerEntry"("tenantId", "symbolNorm");

-- CreateIndex
CREATE INDEX "BrokerLedgerEntry_accountId_tradeDate_idx" ON "BrokerLedgerEntry"("accountId", "tradeDate");

-- AddForeignKey
ALTER TABLE "BrokerLedgerEntry" ADD CONSTRAINT "BrokerLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerLedgerEntry" ADD CONSTRAINT "BrokerLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SnapTradeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
