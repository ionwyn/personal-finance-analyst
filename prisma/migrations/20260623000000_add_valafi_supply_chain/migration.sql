-- CreateTable
CREATE TABLE "ValafiCache" (
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ticker" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValafiCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ValafiTickerDay" (
    "date" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,

    CONSTRAINT "ValafiTickerDay_pkey" PRIMARY KEY ("date","ticker")
);

-- CreateTable
CREATE TABLE "ValafiUsageDay" (
    "date" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "remoteRequests" INTEGER,
    "remoteTickers" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValafiUsageDay_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "ValafiPortfolio" (
    "tenantId" TEXT NOT NULL,
    "portfolioId" INTEGER NOT NULL,
    "holdingsHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValafiPortfolio_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "ValafiCache_ticker_idx" ON "ValafiCache"("ticker");

-- CreateIndex
CREATE INDEX "ValafiCache_kind_fetchedAt_idx" ON "ValafiCache"("kind", "fetchedAt");

-- AddForeignKey
ALTER TABLE "ValafiPortfolio" ADD CONSTRAINT "ValafiPortfolio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
