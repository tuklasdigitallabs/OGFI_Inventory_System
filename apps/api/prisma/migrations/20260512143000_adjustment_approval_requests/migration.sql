CREATE TABLE "adjustment_requests" (
    "id" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "locationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "qtyIn" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "qtyOut" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "unitCostAtTime" DECIMAL(18,6) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "businessDate" TIMESTAMP(3) NOT NULL,
    "reasonCodeId" UUID NOT NULL,
    "remarks" TEXT,
    "requestedById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "ledgerEventId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjustment_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adjustment_requests_requestNumber_key" ON "adjustment_requests"("requestNumber");
CREATE INDEX "adjustment_requests_locationId_status_idx" ON "adjustment_requests"("locationId", "status");
CREATE INDEX "adjustment_requests_itemId_idx" ON "adjustment_requests"("itemId");
CREATE INDEX "adjustment_requests_reasonCodeId_idx" ON "adjustment_requests"("reasonCodeId");
CREATE INDEX "adjustment_requests_requestedById_idx" ON "adjustment_requests"("requestedById");
CREATE INDEX "adjustment_requests_approvedById_idx" ON "adjustment_requests"("approvedById");
CREATE INDEX "adjustment_requests_rejectedById_idx" ON "adjustment_requests"("rejectedById");
CREATE INDEX "adjustment_requests_businessDate_idx" ON "adjustment_requests"("businessDate");

ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_reasonCodeId_fkey" FOREIGN KEY ("reasonCodeId") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
