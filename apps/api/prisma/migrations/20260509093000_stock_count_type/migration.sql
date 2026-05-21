-- CreateEnum
CREATE TYPE "StockCountType" AS ENUM ('OPENING', 'EOD', 'CYCLE', 'SPOT');

-- AlterTable
ALTER TABLE "stock_counts"
ADD COLUMN "countType" "StockCountType" NOT NULL DEFAULT 'EOD';
