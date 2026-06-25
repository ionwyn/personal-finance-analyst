-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN     "lastRecurringFetchAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN     "plaidStreamId" TEXT;

-- CreateTable
CREATE TABLE "PlaidRecurringStream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accountId" TEXT,
    "streamId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "merchantName" TEXT,
    "description" TEXT,
    "frequencyRaw" TEXT NOT NULL,
    "frequency" TEXT,
    "averageAmount" DECIMAL(18,2) NOT NULL,
    "lastAmount" DECIMAL(18,2) NOT NULL,
    "lastDate" TIMESTAMP(3),
    "predictedNextDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "isUserModified" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidRecurringStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaidRecurringStream_streamId_key" ON "PlaidRecurringStream"("streamId");

-- CreateIndex
CREATE INDEX "PlaidRecurringStream_tenantId_direction_isActive_idx" ON "PlaidRecurringStream"("tenantId", "direction", "isActive");

-- CreateIndex
CREATE INDEX "PlaidRecurringStream_itemId_idx" ON "PlaidRecurringStream"("itemId");

-- CreateIndex
CREATE INDEX "RecurringExpense_plaidStreamId_idx" ON "RecurringExpense"("plaidStreamId");

-- AddForeignKey
ALTER TABLE "PlaidRecurringStream" ADD CONSTRAINT "PlaidRecurringStream_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidRecurringStream" ADD CONSTRAINT "PlaidRecurringStream_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
