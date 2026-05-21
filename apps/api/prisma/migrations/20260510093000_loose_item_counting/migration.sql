ALTER TABLE "items"
ADD COLUMN "looseCountEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "looseWholeUomId" UUID,
ADD COLUMN "looseRemainderUomId" UUID,
ADD COLUMN "looseWholeUnitQty" DECIMAL(18, 6);

ALTER TABLE "items"
ADD CONSTRAINT "items_looseWholeUomId_fkey"
FOREIGN KEY ("looseWholeUomId") REFERENCES "uoms"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items"
ADD CONSTRAINT "items_looseRemainderUomId_fkey"
FOREIGN KEY ("looseRemainderUomId") REFERENCES "uoms"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "items_looseCountEnabled_idx" ON "items"("looseCountEnabled");
