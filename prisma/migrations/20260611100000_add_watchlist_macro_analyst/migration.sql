-- AlterTable
ALTER TABLE "MarketProfile" ADD COLUMN     "beta" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "MarketQuote" ADD COLUMN     "avgVolume" BIGINT,
ADD COLUMN     "dayHigh" DECIMAL(18,6),
ADD COLUMN     "dayLow" DECIMAL(18,6),
ADD COLUMN     "prevClose" DECIMAL(18,6);

-- CreateTable
CREATE TABLE "MarketAnalyst" (
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'yahoo',
    "targetLow" DECIMAL(18,6),
    "targetMean" DECIMAL(18,6),
    "targetHigh" DECIMAL(18,6),
    "analystCount" INTEGER,
    "recKey" TEXT,
    "recMean" DECIMAL(6,3),
    "strongBuy" INTEGER,
    "buy" INTEGER,
    "hold" INTEGER,
    "sell" INTEGER,
    "strongSell" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketAnalyst_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "MarketDividend" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'yahoo',
    "date" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketDividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacroPoint" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MacroPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "exchange" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketDividend_symbol_date_idx" ON "MarketDividend"("symbol", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketDividend_symbol_date_key" ON "MarketDividend"("symbol", "date");

-- CreateIndex
CREATE INDEX "MacroPoint_seriesId_date_idx" ON "MacroPoint"("seriesId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MacroPoint_seriesId_date_key" ON "MacroPoint"("seriesId", "date");

-- CreateIndex
CREATE INDEX "WatchlistItem_tenantId_idx" ON "WatchlistItem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_tenantId_symbol_key" ON "WatchlistItem"("tenantId", "symbol");

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

