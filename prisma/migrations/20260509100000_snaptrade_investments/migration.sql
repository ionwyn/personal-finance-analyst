-- CreateEnum
CREATE TYPE "SnapTradeConnectionStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR', 'DISABLED');

-- CreateTable
CREATE TABLE "SnapTradeConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "snapTradeAuthorizationId" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "brokerageName" TEXT,
    "brokerageSlug" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "disabledAt" TIMESTAMP(3),
    "status" "SnapTradeConnectionStatus" NOT NULL DEFAULT 'IDLE',
    "lastSyncAt" TIMESTAMP(3),
    "lastManualRefreshAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SnapTradeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapTradeAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "snapTradeAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionName" TEXT,
    "rawType" TEXT,
    "accountCategory" TEXT,
    "currency" TEXT,
    "totalValue" DECIMAL(24,8),
    "openedAt" TIMESTAMP(3),
    "snapTradeCreatedAt" TIMESTAMP(3),
    "status" TEXT,
    "isPaper" BOOLEAN NOT NULL DEFAULT false,
    "lastHoldingsSyncAt" TIMESTAMP(3),
    "holdingsInitialSyncComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SnapTradeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapTradePosition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "snapTradeSymbolId" TEXT,
    "symbol" TEXT NOT NULL,
    "rawSymbol" TEXT,
    "description" TEXT,
    "assetType" TEXT NOT NULL,
    "exchange" TEXT,
    "currency" TEXT NOT NULL,
    "units" DECIMAL(24,8) NOT NULL,
    "price" DECIMAL(24,8),
    "avgCost" DECIMAL(24,8),
    "marketValueNative" DECIMAL(24,8) NOT NULL,
    "marketValueCad" DECIMAL(24,8) NOT NULL,
    "costNative" DECIMAL(24,8),
    "costCad" DECIMAL(24,8),
    "pnlCad" DECIMAL(24,8),
    "pnlPct" DECIMAL(18,8),
    "cashEquivalent" BOOLEAN NOT NULL DEFAULT false,
    "logoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SnapTradePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapTradeCashBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "cash" DECIMAL(24,8) NOT NULL,
    "buyingPower" DECIMAL(24,8),
    "cashCad" DECIMAL(24,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SnapTradeCashBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapTradeSyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT,
    "source" "SyncSource" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "connectionsCount" INTEGER NOT NULL DEFAULT 0,
    "accountsCount" INTEGER NOT NULL DEFAULT 0,
    "positionsCount" INTEGER NOT NULL DEFAULT 0,
    "balancesCount" INTEGER NOT NULL DEFAULT 0,
    "omittedPositionsCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    CONSTRAINT "SnapTradeSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapTradeFxRate" (
    "id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "rate" DECIMAL(24,10) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SnapTradeFxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapTradeSecurityLogo" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "contentType" TEXT,
    "data" BYTEA,
    "errorMessage" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SnapTradeSecurityLogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SnapTradeConnection_snapTradeAuthorizationId_key" ON "SnapTradeConnection"("snapTradeAuthorizationId");
CREATE INDEX "SnapTradeConnection_tenantId_idx" ON "SnapTradeConnection"("tenantId");
CREATE INDEX "SnapTradeConnection_status_idx" ON "SnapTradeConnection"("status");
CREATE INDEX "SnapTradeConnection_disabled_idx" ON "SnapTradeConnection"("disabled");
CREATE UNIQUE INDEX "SnapTradeAccount_snapTradeAccountId_key" ON "SnapTradeAccount"("snapTradeAccountId");
CREATE INDEX "SnapTradeAccount_tenantId_idx" ON "SnapTradeAccount"("tenantId");
CREATE INDEX "SnapTradeAccount_connectionId_idx" ON "SnapTradeAccount"("connectionId");
CREATE INDEX "SnapTradeAccount_accountCategory_idx" ON "SnapTradeAccount"("accountCategory");
CREATE UNIQUE INDEX "SnapTradePosition_accountId_symbol_currency_key" ON "SnapTradePosition"("accountId", "symbol", "currency");
CREATE INDEX "SnapTradePosition_tenantId_idx" ON "SnapTradePosition"("tenantId");
CREATE INDEX "SnapTradePosition_accountId_idx" ON "SnapTradePosition"("accountId");
CREATE INDEX "SnapTradePosition_symbol_idx" ON "SnapTradePosition"("symbol");
CREATE INDEX "SnapTradePosition_assetType_idx" ON "SnapTradePosition"("assetType");
CREATE UNIQUE INDEX "SnapTradeCashBalance_accountId_currency_key" ON "SnapTradeCashBalance"("accountId", "currency");
CREATE INDEX "SnapTradeCashBalance_tenantId_idx" ON "SnapTradeCashBalance"("tenantId");
CREATE INDEX "SnapTradeSyncRun_tenantId_startedAt_idx" ON "SnapTradeSyncRun"("tenantId", "startedAt");
CREATE INDEX "SnapTradeSyncRun_connectionId_status_idx" ON "SnapTradeSyncRun"("connectionId", "status");
CREATE INDEX "SnapTradeSyncRun_source_idx" ON "SnapTradeSyncRun"("source");
CREATE UNIQUE INDEX "SnapTradeFxRate_pair_key" ON "SnapTradeFxRate"("pair");
CREATE INDEX "SnapTradeFxRate_sourceCurrency_targetCurrency_idx" ON "SnapTradeFxRate"("sourceCurrency", "targetCurrency");
CREATE INDEX "SnapTradeFxRate_fetchedAt_idx" ON "SnapTradeFxRate"("fetchedAt");
CREATE INDEX "SnapTradeSecurityLogo_status_idx" ON "SnapTradeSecurityLogo"("status");

-- AddForeignKey
ALTER TABLE "SnapTradeConnection" ADD CONSTRAINT "SnapTradeConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradeAccount" ADD CONSTRAINT "SnapTradeAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradeAccount" ADD CONSTRAINT "SnapTradeAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SnapTradeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradePosition" ADD CONSTRAINT "SnapTradePosition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradePosition" ADD CONSTRAINT "SnapTradePosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SnapTradeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradePosition" ADD CONSTRAINT "SnapTradePosition_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "SnapTradeSecurityLogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SnapTradeCashBalance" ADD CONSTRAINT "SnapTradeCashBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradeCashBalance" ADD CONSTRAINT "SnapTradeCashBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SnapTradeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradeSyncRun" ADD CONSTRAINT "SnapTradeSyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapTradeSyncRun" ADD CONSTRAINT "SnapTradeSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SnapTradeConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
