-- CreateTable
CREATE TABLE "CalendarPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "disabledCategories" TEXT[],
    "hiddenKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacroReleaseDate" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MacroReleaseDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarPreference_tenantId_key" ON "CalendarPreference"("tenantId");

-- CreateIndex
CREATE INDEX "MacroReleaseDate_releaseId_date_idx" ON "MacroReleaseDate"("releaseId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MacroReleaseDate_releaseId_date_key" ON "MacroReleaseDate"("releaseId", "date");

-- AddForeignKey
ALTER TABLE "CalendarPreference" ADD CONSTRAINT "CalendarPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

