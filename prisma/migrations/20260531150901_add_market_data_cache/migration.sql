-- CreateTable
CREATE TABLE "MarketQuote" (
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'yahoo',
    "currency" TEXT,
    "price" DECIMAL(18,6),
    "change" DECIMAL(18,6),
    "changePct" DECIMAL(10,6),
    "open" DECIMAL(18,6),
    "high52w" DECIMAL(18,6),
    "low52w" DECIMAL(18,6),
    "volume" BIGINT,
    "marketCap" DECIMAL(24,2),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketQuote_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "MarketProfile" (
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'yahoo',
    "name" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "country" TEXT,
    "description" TEXT,
    "isFund" BOOLEAN NOT NULL DEFAULT false,
    "peRatio" DECIMAL(10,4),
    "forwardPe" DECIMAL(10,4),
    "pbRatio" DECIMAL(10,4),
    "evEbitda" DECIMAL(10,4),
    "revenueGrowthPct" DECIMAL(10,4),
    "epsGrowthPct" DECIMAL(10,4),
    "grossMarginPct" DECIMAL(10,4),
    "operatingMarginPct" DECIMAL(10,4),
    "freeCashFlow" DECIMAL(24,2),
    "dividendYieldPct" DECIMAL(10,4),
    "expenseRatioPct" DECIMAL(10,4),
    "aum" DECIMAL(24,2),
    "holdingsCount" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketProfile_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "MarketPriceDay" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'yahoo',
    "date" TEXT NOT NULL,
    "close" DECIMAL(18,6) NOT NULL,
    "open" DECIMAL(18,6),
    "high" DECIMAL(18,6),
    "low" DECIMAL(18,6),
    "volume" BIGINT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPriceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketNews" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'yahoo',
    "title" TEXT NOT NULL,
    "source" TEXT,
    "url" TEXT,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketNews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPriceDay_symbol_date_idx" ON "MarketPriceDay"("symbol", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceDay_symbol_date_key" ON "MarketPriceDay"("symbol", "date");

-- CreateIndex
CREATE INDEX "MarketNews_symbol_publishedAt_idx" ON "MarketNews"("symbol", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "MarketNews_symbol_fetchedAt_idx" ON "MarketNews"("symbol", "fetchedAt" DESC);
