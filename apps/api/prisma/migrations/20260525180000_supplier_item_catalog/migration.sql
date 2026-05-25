-- Supplier item catalog details let purchasing users choose the exact brand,
-- supplier SKU, and pack option while inventory remains tied to the internal item.
ALTER TABLE "supplier_items"
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "supplierSku" TEXT,
  ADD COLUMN "packSize" TEXT,
  ADD COLUMN "purchaseUomId" UUID,
  ADD COLUMN "conversionToBase" DECIMAL(18,6);

ALTER TABLE "purchase_order_lines"
  ADD COLUMN "supplierItemId" UUID;

DROP INDEX "supplier_items_supplierId_itemId_key";

CREATE UNIQUE INDEX "supplier_items_supplierId_itemId_supplierSku_key"
  ON "supplier_items"("supplierId", "itemId", "supplierSku");

CREATE INDEX "supplier_items_purchaseUomId_idx" ON "supplier_items"("purchaseUomId");
CREATE INDEX "purchase_order_lines_supplierItemId_idx" ON "purchase_order_lines"("supplierItemId");

ALTER TABLE "supplier_items"
  ADD CONSTRAINT "supplier_items_purchaseUomId_fkey"
  FOREIGN KEY ("purchaseUomId") REFERENCES "uoms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_supplierItemId_fkey"
  FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
