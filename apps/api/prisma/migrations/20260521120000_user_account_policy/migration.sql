ALTER TABLE "users"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN "restrictedAt" TIMESTAMP(3),
ADD COLUMN "restrictedReason" TEXT,
ADD COLUMN "restrictionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "restrictionWindowStart" TIMESTAMP(3),
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockReason" TEXT;
