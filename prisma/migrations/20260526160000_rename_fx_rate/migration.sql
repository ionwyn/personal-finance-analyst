-- FX moved off SnapTrade (now Twelve Data). Rename the cache table + its
-- constraints/indexes to the provider-neutral "FxRate" while preserving rows.
ALTER TABLE "SnapTradeFxRate" RENAME TO "FxRate";

ALTER TABLE "FxRate" RENAME CONSTRAINT "SnapTradeFxRate_pkey" TO "FxRate_pkey";

ALTER INDEX "SnapTradeFxRate_pair_key" RENAME TO "FxRate_pair_key";
ALTER INDEX "SnapTradeFxRate_sourceCurrency_targetCurrency_idx" RENAME TO "FxRate_sourceCurrency_targetCurrency_idx";
ALTER INDEX "SnapTradeFxRate_fetchedAt_idx" RENAME TO "FxRate_fetchedAt_idx";
