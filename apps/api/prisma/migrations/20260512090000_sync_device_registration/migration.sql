-- Add registered offline sync devices and submitted-by tracking.
ALTER TABLE "sync_batches"
ADD COLUMN "submittedById" UUID;

CREATE TABLE "sync_devices" (
    "id" UUID NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "locationId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sync_devices_deviceCode_key" ON "sync_devices"("deviceCode");
CREATE INDEX "sync_batches_submittedById_idx" ON "sync_batches"("submittedById");
CREATE INDEX "sync_devices_locationId_active_idx" ON "sync_devices"("locationId", "active");

ALTER TABLE "sync_batches"
ADD CONSTRAINT "sync_batches_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sync_devices"
ADD CONSTRAINT "sync_devices_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
