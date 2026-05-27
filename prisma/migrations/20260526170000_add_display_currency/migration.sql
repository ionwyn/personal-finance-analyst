-- Display currency preference (CAD or USD; base data is CAD). Default CAD.
ALTER TABLE "UserSettings" ADD COLUMN "displayCurrency" TEXT NOT NULL DEFAULT 'CAD';
