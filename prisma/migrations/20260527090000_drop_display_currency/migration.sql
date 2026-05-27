-- Revert the deferred display-currency feature. The Twelve Data FX provider
-- swap (FxRate) stays; only the per-tenant display-currency preference is removed.
ALTER TABLE "UserSettings" DROP COLUMN "displayCurrency";
