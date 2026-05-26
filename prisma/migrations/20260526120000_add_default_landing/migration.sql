-- Add per-tenant default landing page preference (Settings → Display & Preferences)
ALTER TABLE "UserSettings" ADD COLUMN "defaultLanding" TEXT NOT NULL DEFAULT 'dashboard';
