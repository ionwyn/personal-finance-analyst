-- AlterTable
ALTER TABLE "MarketNews" ADD COLUMN     "relevance" TEXT,
ADD COLUMN     "tag" TEXT;

-- CreateTable
CREATE TABLE "MarketEvents" (
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'yahoo',
    "nextEarnings" TIMESTAMP(3),
    "exDividend" TIMESTAMP(3),
    "dividendDate" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketEvents_pkey" PRIMARY KEY ("symbol")
);
