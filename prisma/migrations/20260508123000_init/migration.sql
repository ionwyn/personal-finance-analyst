-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantKind" AS ENUM ('PERSONAL', 'DEMO');

-- CreateEnum
CREATE TYPE "PlaidItemStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'SEED');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'ERROR', 'SKIPPED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TenantKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "tenantId" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PlaidItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT,
    "plaidItemId" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "syncCursor" TEXT,
    "status" "PlaidItemStatus" NOT NULL DEFAULT 'IDLE',
    "lastSyncAt" TIMESTAMP(3),
    "lastBalanceRefreshAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaidAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "mask" TEXT,
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "availableBalance" DECIMAL(18,2),
    "currentBalance" DECIMAL(18,2),
    "limit" DECIMAL(18,2),
    "lastBalanceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlaidAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaidTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "plaidTransactionId" TEXT NOT NULL,
    "pendingTransactionId" TEXT,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "authorizedDate" TIMESTAMP(3),
    "datetime" TIMESTAMP(3),
    "authorizedDatetime" TIMESTAMP(3),
    "paymentChannel" TEXT,
    "categoryPrimary" TEXT,
    "categoryDetailed" TEXT,
    "categoryConfidence" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlaidTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "availableBalance" DECIMAL(18,2),
    "currentBalance" DECIMAL(18,2),
    "limit" DECIMAL(18,2),
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL,
    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT,
    "source" "SyncSource" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "modifiedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "accountsCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "plaidRequestId" TEXT,
    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_kind_idx" ON "Tenant"("kind");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "PlaidItem_plaidItemId_key" ON "PlaidItem"("plaidItemId");
CREATE INDEX "PlaidItem_tenantId_idx" ON "PlaidItem"("tenantId");
CREATE INDEX "PlaidItem_status_idx" ON "PlaidItem"("status");
CREATE INDEX "PlaidItem_createdById_idx" ON "PlaidItem"("createdById");
CREATE UNIQUE INDEX "PlaidAccount_plaidAccountId_key" ON "PlaidAccount"("plaidAccountId");
CREATE INDEX "PlaidAccount_tenantId_idx" ON "PlaidAccount"("tenantId");
CREATE INDEX "PlaidAccount_itemId_idx" ON "PlaidAccount"("itemId");
CREATE INDEX "PlaidAccount_type_subtype_idx" ON "PlaidAccount"("type", "subtype");
CREATE UNIQUE INDEX "PlaidTransaction_plaidTransactionId_key" ON "PlaidTransaction"("plaidTransactionId");
CREATE INDEX "PlaidTransaction_tenantId_date_idx" ON "PlaidTransaction"("tenantId", "date");
CREATE INDEX "PlaidTransaction_accountId_date_idx" ON "PlaidTransaction"("accountId", "date");
CREATE INDEX "PlaidTransaction_itemId_idx" ON "PlaidTransaction"("itemId");
CREATE INDEX "PlaidTransaction_removed_idx" ON "PlaidTransaction"("removed");
CREATE INDEX "PlaidTransaction_merchantName_idx" ON "PlaidTransaction"("merchantName");
CREATE INDEX "PlaidTransaction_categoryPrimary_idx" ON "PlaidTransaction"("categoryPrimary");
CREATE INDEX "BalanceSnapshot_tenantId_capturedAt_idx" ON "BalanceSnapshot"("tenantId", "capturedAt");
CREATE INDEX "BalanceSnapshot_accountId_capturedAt_idx" ON "BalanceSnapshot"("accountId", "capturedAt");
CREATE INDEX "SyncRun_tenantId_startedAt_idx" ON "SyncRun"("tenantId", "startedAt");
CREATE INDEX "SyncRun_itemId_status_idx" ON "SyncRun"("itemId", "status");
CREATE INDEX "SyncRun_source_idx" ON "SyncRun"("source");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaidItem" ADD CONSTRAINT "PlaidItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaidItem" ADD CONSTRAINT "PlaidItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlaidAccount" ADD CONSTRAINT "PlaidAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaidAccount" ADD CONSTRAINT "PlaidAccount_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaidTransaction" ADD CONSTRAINT "PlaidTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaidTransaction" ADD CONSTRAINT "PlaidTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaidTransaction" ADD CONSTRAINT "PlaidTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlaidAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlaidAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
