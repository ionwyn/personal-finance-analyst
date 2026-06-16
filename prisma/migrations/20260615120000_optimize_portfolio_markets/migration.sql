-- Hot-path portfolio and markets query indexes.
CREATE INDEX "BrokerLedgerEntry_tenantId_tradeDate_createdAt_idx"
  ON "BrokerLedgerEntry" ("tenantId", "tradeDate" DESC, "createdAt" DESC);

CREATE INDEX "BrokerLedgerEntry_tenantId_activityType_tradeDate_idx"
  ON "BrokerLedgerEntry" ("tenantId", "activityType", "tradeDate");

CREATE INDEX "BrokerLedgerEntry_tenantId_symbolNorm_tradeDate_createdAt_idx"
  ON "BrokerLedgerEntry" ("tenantId", "symbolNorm", "tradeDate" DESC, "createdAt" DESC);

CREATE INDEX "SnapTradePosition_accountId_marketValueCad_idx"
  ON "SnapTradePosition" ("accountId", "marketValueCad" DESC);

CREATE INDEX "BrokerLedgerSourceRecord_ledgerEntryId_provider_sourceKey_idx"
  ON "BrokerLedgerSourceRecord" ("ledgerEntryId", "provider", "sourceKey");

-- Request-time performance pages read these tables; refresh/backfill paths
-- rebuild them from BrokerLedgerEntry, MarketPriceDay, and MacroPoint.
CREATE TABLE "PortfolioPerformanceSummary" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "asOf" DATE NOT NULL,
  "inceptionDate" DATE,
  "terminalDate" DATE,
  "terminalValueCad" DECIMAL(24, 10),
  "terminalSecuritiesValueCad" DECIMAL(24, 10),
  "terminalCashCad" DECIMAL(24, 10),
  "syncedValueCad" DECIMAL(24, 10) NOT NULL,
  "syncedSecuritiesValueCad" DECIMAL(24, 10) NOT NULL,
  "syncedCashCad" DECIMAL(24, 10) NOT NULL,
  "terminalDifferenceCad" DECIMAL(24, 10),
  "terminalDifferencePct" DECIMAL(18, 10),
  "cashDifferenceCad" DECIMAL(24, 10),
  "terminalReconciled" BOOLEAN NOT NULL,
  "resolvedSymbols" INTEGER NOT NULL,
  "lifetimeSymbols" INTEGER NOT NULL,
  "fxSource" TEXT NOT NULL,
  "twr3M" DECIMAL(18, 10),
  "twr6M" DECIMAL(18, 10),
  "twr1Y" DECIMAL(18, 10),
  "twrAll" DECIMAL(18, 10),
  "mwr" DECIMAL(18, 10),
  "coverageIssues" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PortfolioPerformanceSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioPerformancePoint" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "summaryId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "portfolio" DECIMAL(24, 10) NOT NULL,
  "spx" DECIMAL(24, 10),
  "tsx" DECIMAL(24, 10),
  "valueCad" DECIMAL(24, 10),
  "securitiesValueCad" DECIMAL(24, 10),
  "cashCad" DECIMAL(24, 10),

  CONSTRAINT "PortfolioPerformancePoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioPerformanceSummary_tenantId_asOf_key"
  ON "PortfolioPerformanceSummary" ("tenantId", "asOf");

CREATE INDEX "PortfolioPerformanceSummary_tenantId_generatedAt_idx"
  ON "PortfolioPerformanceSummary" ("tenantId", "generatedAt");

CREATE UNIQUE INDEX "PortfolioPerformancePoint_summaryId_date_key"
  ON "PortfolioPerformancePoint" ("summaryId", "date");

CREATE INDEX "PortfolioPerformancePoint_tenantId_date_idx"
  ON "PortfolioPerformancePoint" ("tenantId", "date");

ALTER TABLE "PortfolioPerformanceSummary"
  ADD CONSTRAINT "PortfolioPerformanceSummary_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioPerformancePoint"
  ADD CONSTRAINT "PortfolioPerformancePoint_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioPerformancePoint"
  ADD CONSTRAINT "PortfolioPerformancePoint_summaryId_fkey"
  FOREIGN KEY ("summaryId") REFERENCES "PortfolioPerformanceSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
