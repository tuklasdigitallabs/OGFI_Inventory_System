export type LocalSyncEvent = {
  uuid: string;
  deviceId: string;
  eventType: string;
  itemId: string;
  locationId: string;
  qtyIn: string;
  qtyOut: string;
  reasonCodeId?: string;
  remarks?: string;
  unitCostAtTime: string;
  businessDate: string;
  status: "QUEUED" | "REJECTED";
  rejectionReason: string | null;
};
