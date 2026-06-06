-- CreateTable
CREATE TABLE "CommittedSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "transactionId" TEXT,
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommittedSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommittedSettlement_tenantId_cycleId_idx" ON "CommittedSettlement"("tenantId", "cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "CommittedSettlement_recurringExpenseId_cycleId_key" ON "CommittedSettlement"("recurringExpenseId", "cycleId");

-- AddForeignKey
ALTER TABLE "CommittedSettlement" ADD CONSTRAINT "CommittedSettlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommittedSettlement" ADD CONSTRAINT "CommittedSettlement_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommittedSettlement" ADD CONSTRAINT "CommittedSettlement_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PayCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommittedSettlement" ADD CONSTRAINT "CommittedSettlement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PlaidTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
