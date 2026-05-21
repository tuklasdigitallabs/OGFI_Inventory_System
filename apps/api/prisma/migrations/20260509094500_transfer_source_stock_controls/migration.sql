-- AlterTable
ALTER TABLE "transfers"
ADD COLUMN "requiresLowStockApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lowStockApprovalReason" TEXT;

-- AlterTable
ALTER TABLE "transfer_lines"
ADD COLUMN "sourceQtyAvailableAtRequest" DECIMAL(18, 6),
ADD COLUMN "sourceQtyRemainingAfterRequest" DECIMAL(18, 6),
ADD COLUMN "sourceLowStockThreshold" DECIMAL(18, 6),
ADD COLUMN "sourceLowStockAfterRequest" BOOLEAN NOT NULL DEFAULT false;
