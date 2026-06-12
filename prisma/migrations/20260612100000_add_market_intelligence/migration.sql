-- CreateTable
CREATE TABLE "MarketIntelFetch" (
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketIntelFetch_pkey" PRIMARY KEY ("symbol","kind")
);

-- CreateTable
CREATE TABLE "MarketEarnings" (
    "symbol" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'finnhub',
    "quarter" INTEGER,
    "year" INTEGER,
    "epsActual" DECIMAL(18,6),
    "epsEstimate" DECIMAL(18,6),
    "surprisePct" DECIMAL(12,4),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketEarnings_pkey" PRIMARY KEY ("symbol","period")
);

-- CreateTable
CREATE TABLE "MarketRecTrend" (
    "symbol" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'finnhub',
    "strongBuy" INTEGER NOT NULL DEFAULT 0,
    "buy" INTEGER NOT NULL DEFAULT 0,
    "hold" INTEGER NOT NULL DEFAULT 0,
    "sell" INTEGER NOT NULL DEFAULT 0,
    "strongSell" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketRecTrend_pkey" PRIMARY KEY ("symbol","period")
);

-- CreateTable
CREATE TABLE "MarketInsiderTx" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'finnhub',
    "name" TEXT NOT NULL,
    "share" BIGINT,
    "change" BIGINT,
    "txPrice" DECIMAL(18,6),
    "txCode" TEXT,
    "txDate" TEXT,
    "filingDate" TEXT,
    "isDerivative" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketInsiderTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPeers" (
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'finnhub',
    "peers" TEXT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPeers_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "MarketFiling" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'edgar',
    "accession" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "filedAt" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketFinancials" (
    "symbol" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fmp',
    "endDate" TEXT,
    "currency" TEXT,
    "revenue" DECIMAL(24,2),
    "grossProfit" DECIMAL(24,2),
    "operatingIncome" DECIMAL(24,2),
    "netIncome" DECIMAL(24,2),
    "epsDiluted" DECIMAL(18,6),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketFinancials_pkey" PRIMARY KEY ("symbol","fiscalYear")
);

-- CreateIndex
CREATE INDEX "MarketEarnings_symbol_period_idx" ON "MarketEarnings"("symbol", "period" DESC);

-- CreateIndex
CREATE INDEX "MarketRecTrend_symbol_period_idx" ON "MarketRecTrend"("symbol", "period" DESC);

-- CreateIndex
CREATE INDEX "MarketInsiderTx_symbol_txDate_idx" ON "MarketInsiderTx"("symbol", "txDate" DESC);

-- CreateIndex
CREATE INDEX "MarketFiling_symbol_filedAt_idx" ON "MarketFiling"("symbol", "filedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketFiling_symbol_accession_key" ON "MarketFiling"("symbol", "accession");

-- CreateIndex
CREATE INDEX "MarketFinancials_symbol_fiscalYear_idx" ON "MarketFinancials"("symbol", "fiscalYear" DESC);

