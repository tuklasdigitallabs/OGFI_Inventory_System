ALTER TABLE "purchase_order_lines"
ADD COLUMN "defaultUnitCost" DECIMAL(18,6),
ADD COLUMN "costOverrideReason" TEXT,
ADD COLUMN "costOverriddenById" UUID,
ADD COLUMN "costOverriddenAt" TIMESTAMP(3),
ADD COLUMN "costOverrideApprovedById" UUID,
ADD COLUMN "costOverrideApprovedAt" TIMESTAMP(3);

CREATE INDEX "purchase_order_lines_costOverriddenById_idx" ON "purchase_order_lines"("costOverriddenById");
CREATE INDEX "purchase_order_lines_costOverrideApprovedById_idx" ON "purchase_order_lines"("costOverrideApprovedById");

ALTER TABLE "purchase_order_lines"
ADD CONSTRAINT "purchase_order_lines_costOverriddenById_fkey"
FOREIGN KEY ("costOverriddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_order_lines"
ADD CONSTRAINT "purchase_order_lines_costOverrideApprovedById_fkey"
FOREIGN KEY ("costOverrideApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
