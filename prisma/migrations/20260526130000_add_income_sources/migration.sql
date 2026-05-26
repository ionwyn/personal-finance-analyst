-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "matchPattern" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeSource_tenantId_active_idx" ON "IncomeSource"("tenantId", "active");

-- AddForeignKey
ALTER TABLE "IncomeSource" ADD CONSTRAINT "IncomeSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: seed an IncomeSource from each tenant's existing
-- UserSettings.employerMerchantPattern so no income classification is lost when
-- the single-employer field is superseded by the 1:N IncomeSource model.
INSERT INTO "IncomeSource" ("id", "tenantId", "label", "matchPattern", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "tenantId", 'Primary employer', upper(btrim("employerMerchantPattern")), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "UserSettings"
WHERE "employerMerchantPattern" IS NOT NULL AND btrim("employerMerchantPattern") <> '';
