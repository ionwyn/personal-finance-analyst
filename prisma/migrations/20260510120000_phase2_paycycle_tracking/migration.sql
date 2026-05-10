-- AlterTable
ALTER TABLE "PlaidTransaction" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "cycleId" TEXT,
ADD COLUMN     "isManuallyCategorized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'plaid',
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "txnType" TEXT NOT NULL DEFAULT 'expense';

-- CreateTable
CREATE TABLE "PayCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "incomeReceived" DECIMAL(18,2),
    "fixedSavingsPull" DECIMAL(18,2),
    "sweptAmount" DECIMAL(18,2),
    "carryover" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditCardPaymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantPattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "merchantPattern" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "frequency" TEXT NOT NULL,
    "anchorDate" INTEGER,
    "accrualPerCycle" DECIMAL(18,2) NOT NULL,
    "categoryId" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsDestination" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "matchPattern" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementPattern" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "matchPattern" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payFrequencyDays" INTEGER NOT NULL DEFAULT 14,
    "lastPaycheckDate" TIMESTAMP(3),
    "employerMerchantPattern" TEXT,
    "defaultFixedSavings" DECIMAL(18,2),
    "sweepBuffer" DECIMAL(18,2) NOT NULL DEFAULT 100,
    "ccPaymentDayOfMonth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayCycle_tenantId_startDate_endDate_idx" ON "PayCycle"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayCycle_tenantId_startDate_key" ON "PayCycle"("tenantId", "startDate");

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_name_parentId_key" ON "Category"("tenantId", "name", "parentId");

-- CreateIndex
CREATE INDEX "CategoryRule_tenantId_priority_idx" ON "CategoryRule"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "CategoryRule_categoryId_idx" ON "CategoryRule"("categoryId");

-- CreateIndex
CREATE INDEX "RecurringExpense_tenantId_active_idx" ON "RecurringExpense"("tenantId", "active");

-- CreateIndex
CREATE INDEX "RecurringExpense_categoryId_idx" ON "RecurringExpense"("categoryId");

-- CreateIndex
CREATE INDEX "SavingsDestination_tenantId_active_idx" ON "SavingsDestination"("tenantId", "active");

-- CreateIndex
CREATE INDEX "SettlementPattern_tenantId_active_idx" ON "SettlementPattern"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_tenantId_key" ON "UserSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidTransaction_supersededById_key" ON "PlaidTransaction"("supersededById");

-- CreateIndex
CREATE INDEX "PlaidTransaction_tenantId_cycleId_idx" ON "PlaidTransaction"("tenantId", "cycleId");

-- CreateIndex
CREATE INDEX "PlaidTransaction_tenantId_txnType_date_idx" ON "PlaidTransaction"("tenantId", "txnType", "date");

-- CreateIndex
CREATE INDEX "PlaidTransaction_categoryId_idx" ON "PlaidTransaction"("categoryId");

-- AddForeignKey
ALTER TABLE "PlaidTransaction" ADD CONSTRAINT "PlaidTransaction_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PayCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidTransaction" ADD CONSTRAINT "PlaidTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidTransaction" ADD CONSTRAINT "PlaidTransaction_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "PlaidTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayCycle" ADD CONSTRAINT "PayCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsDestination" ADD CONSTRAINT "SavingsDestination_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPattern" ADD CONSTRAINT "SettlementPattern_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

