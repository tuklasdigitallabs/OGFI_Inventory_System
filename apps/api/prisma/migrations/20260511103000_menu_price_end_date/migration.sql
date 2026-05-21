ALTER TABLE "menu_prices"
ADD COLUMN "effectiveEndDate" TIMESTAMP(3);

CREATE INDEX "menu_prices_effectiveEndDate_idx" ON "menu_prices"("effectiveEndDate");
