-- Remove custom user-defined category system; use Plaid categoryPrimary instead

-- Drop FK-bearing columns first (auto-drops the FK constraints)
ALTER TABLE "PlaidTransaction" DROP COLUMN IF EXISTS "categoryId";
ALTER TABLE "PlaidTransaction" DROP COLUMN IF EXISTS "isManuallyCategorized";
ALTER TABLE "RecurringExpense" DROP COLUMN IF EXISTS "categoryId";

-- Drop dependent table before parent
DROP TABLE IF EXISTS "CategoryRule";
DROP TABLE IF EXISTS "Category";

-- Drop orphaned index (was on PlaidTransaction.categoryId)
DROP INDEX IF EXISTS "PlaidTransaction_categoryId_idx";
DROP INDEX IF EXISTS "RecurringExpense_categoryId_idx";
