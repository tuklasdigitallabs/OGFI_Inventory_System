ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'EMERGENCY_PURCHASE';

CREATE TABLE "emergency_purchases" (
  "id" UUID NOT NULL,
  "purchaseNumber" TEXT NOT NULL,
  "locationId" UUID NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
  "businessDate" TIMESTAMP(3) NOT NULL,
  "sourceName" TEXT NOT NULL,
  "receiptReference" TEXT,
  "reason" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "emergency_purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "emergency_purchase_lines" (
  "id" UUID NOT NULL,
  "emergencyPurchaseId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "uomId" UUID NOT NULL,
  "qty" DECIMAL(18,6) NOT NULL,
  "unitCost" DECIMAL(18,6) NOT NULL,
  "brand" TEXT,

  CONSTRAINT "emergency_purchase_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "emergency_purchases_purchaseNumber_key"
  ON "emergency_purchases"("purchaseNumber");

CREATE INDEX "emergency_purchases_locationId_businessDate_idx"
  ON "emergency_purchases"("locationId", "businessDate");

CREATE INDEX "emergency_purchase_lines_itemId_idx"
  ON "emergency_purchase_lines"("itemId");

CREATE INDEX "emergency_purchase_lines_uomId_idx"
  ON "emergency_purchase_lines"("uomId");

ALTER TABLE "emergency_purchases"
  ADD CONSTRAINT "emergency_purchases_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "emergency_purchase_lines"
  ADD CONSTRAINT "emergency_purchase_lines_emergencyPurchaseId_fkey"
  FOREIGN KEY ("emergencyPurchaseId") REFERENCES "emergency_purchases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "emergency_purchase_lines"
  ADD CONSTRAINT "emergency_purchase_lines_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "emergency_purchase_lines"
  ADD CONSTRAINT "emergency_purchase_lines_uomId_fkey"
  FOREIGN KEY ("uomId") REFERENCES "uoms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
