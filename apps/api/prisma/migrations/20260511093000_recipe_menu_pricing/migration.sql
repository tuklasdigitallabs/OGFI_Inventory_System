CREATE TYPE "PriceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

ALTER TABLE "recipes"
ADD COLUMN "yieldOverrideReason" TEXT,
ADD COLUMN "yieldOverriddenById" UUID,
ADD COLUMN "yieldOverriddenAt" TIMESTAMP(3),
ADD COLUMN "yieldOverrideApprovedById" UUID,
ADD COLUMN "yieldOverrideApprovedAt" TIMESTAMP(3),
ADD COLUMN "wastageOverrideReason" TEXT,
ADD COLUMN "wastageOverriddenById" UUID,
ADD COLUMN "wastageOverriddenAt" TIMESTAMP(3),
ADD COLUMN "wastageOverrideApprovedById" UUID,
ADD COLUMN "wastageOverrideApprovedAt" TIMESTAMP(3);

CREATE TABLE "recipe_yield_observations" (
  "id" UUID NOT NULL,
  "recipeId" UUID NOT NULL,
  "expectedOutputQty" DECIMAL(18, 6) NOT NULL,
  "actualOutputQty" DECIMAL(18, 6) NOT NULL,
  "computedYieldPercent" DECIMAL(5, 2) NOT NULL,
  "notes" TEXT,
  "observedById" UUID NOT NULL,
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recipe_yield_observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "menu_prices" (
  "id" UUID NOT NULL,
  "recipeId" UUID NOT NULL,
  "outputItemId" UUID NOT NULL,
  "locationId" UUID,
  "channel" TEXT NOT NULL DEFAULT 'BASE',
  "sellingPrice" DECIMAL(18, 6) NOT NULL,
  "targetFoodCostPercent" DECIMAL(5, 2),
  "targetGrossMarginPercent" DECIMAL(5, 2),
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "status" "PriceStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID,
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "menu_prices_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_yieldOverriddenById_fkey"
FOREIGN KEY ("yieldOverriddenById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_yieldOverrideApprovedById_fkey"
FOREIGN KEY ("yieldOverrideApprovedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_wastageOverriddenById_fkey"
FOREIGN KEY ("wastageOverriddenById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_wastageOverrideApprovedById_fkey"
FOREIGN KEY ("wastageOverrideApprovedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recipe_yield_observations"
ADD CONSTRAINT "recipe_yield_observations_recipeId_fkey"
FOREIGN KEY ("recipeId") REFERENCES "recipes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_yield_observations"
ADD CONSTRAINT "recipe_yield_observations_observedById_fkey"
FOREIGN KEY ("observedById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recipe_yield_observations"
ADD CONSTRAINT "recipe_yield_observations_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "menu_prices"
ADD CONSTRAINT "menu_prices_recipeId_fkey"
FOREIGN KEY ("recipeId") REFERENCES "recipes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "menu_prices"
ADD CONSTRAINT "menu_prices_outputItemId_fkey"
FOREIGN KEY ("outputItemId") REFERENCES "items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "menu_prices"
ADD CONSTRAINT "menu_prices_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "menu_prices"
ADD CONSTRAINT "menu_prices_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "menu_prices"
ADD CONSTRAINT "menu_prices_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "recipes_yieldOverriddenById_idx" ON "recipes"("yieldOverriddenById");
CREATE INDEX "recipes_yieldOverrideApprovedById_idx" ON "recipes"("yieldOverrideApprovedById");
CREATE INDEX "recipes_wastageOverriddenById_idx" ON "recipes"("wastageOverriddenById");
CREATE INDEX "recipes_wastageOverrideApprovedById_idx" ON "recipes"("wastageOverrideApprovedById");
CREATE INDEX "recipe_yield_observations_recipeId_createdAt_idx" ON "recipe_yield_observations"("recipeId", "createdAt");
CREATE INDEX "recipe_yield_observations_observedById_idx" ON "recipe_yield_observations"("observedById");
CREATE INDEX "recipe_yield_observations_approvedById_idx" ON "recipe_yield_observations"("approvedById");
CREATE INDEX "menu_prices_recipeId_idx" ON "menu_prices"("recipeId");
CREATE INDEX "menu_prices_outputItemId_idx" ON "menu_prices"("outputItemId");
CREATE INDEX "menu_prices_locationId_idx" ON "menu_prices"("locationId");
CREATE INDEX "menu_prices_status_active_idx" ON "menu_prices"("status", "active");
CREATE INDEX "menu_prices_effectiveDate_idx" ON "menu_prices"("effectiveDate");
