ALTER TABLE "MarketProfile"
ADD COLUMN "profileFetchedAt" TIMESTAMP(3),
ADD COLUMN "fundamentalsFetchedAt" TIMESTAMP(3);

UPDATE "MarketProfile"
SET
    "profileFetchedAt" = "fetchedAt",
    "fundamentalsFetchedAt" = "fetchedAt";
