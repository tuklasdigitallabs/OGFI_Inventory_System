import {
  deleteCachedValue,
  getCachedValue,
  setCachedValue,
} from "./offline-db";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export const TOKEN_KEY = "ogfi.accessToken";

export type AuthenticatedUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  mustChangePassword: boolean;
  role: {
    id: string;
    code: string;
    name: string;
  };
  permissions: string[];
  locationIds: string[];
};

export type StockOnHandRow = {
  locationId: string;
  locationCode: string;
  locationName: string;
  itemId: string;
  sku: string;
  itemName: string;
  itemType: string;
  categoryId: string | null;
  categoryName: string | null;
  baseUomCode: string;
  displayQty?: string;
  looseCountEnabled?: boolean;
  looseRemainderUomCode?: string | null;
  looseWholeUnitQty?: string | null;
  looseWholeUomCode?: string | null;
  qtyOnHand: string;
  reservedOutQty?: string;
  inTransitInQty?: string;
  availableQty?: string;
  displayAvailableQty?: string;
  averageUnitCost: string;
  inventoryValue: string;
  lowStockThreshold: string | null;
  stockStatus?: "OK" | "LOW" | "OUT_OF_STOCK";
  belowLowStock: boolean;
  lastBusinessDate: string;
  lastMovementAt: string;
};

export type LedgerMovementRow = {
  id: string;
  uuid: string;
  locationId: string;
  itemId: string;
  transactionType: string;
  qtyIn: string;
  qtyOut: string;
  unitCostAtTime: string;
  extendedCost: string;
  referenceType: string;
  referenceId: string;
  businessDate: string;
  createdAt: string;
};

export type AdjustmentRequest = {
  id: string;
  requestNumber: string;
  locationId: string;
  itemId: string;
  qtyIn: string;
  qtyOut: string;
  unitCostAtTime: string;
  status: string;
  businessDate: string;
  reasonCodeId: string;
  remarks: string | null;
  requestedById: string;
  approvedById: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  ledgerEventId: string | null;
  location?: MasterDataRecord;
  item?: MasterDataRecord & { baseUom?: MasterDataRecord };
  reasonCode?: MasterDataRecord;
  requestedBy?: MasterDataRecord;
  approvedBy?: MasterDataRecord | null;
  rejectedBy?: MasterDataRecord | null;
  createdAt: string;
  updatedAt: string;
};

export type MasterDataResource =
  | "items"
  | "uoms"
  | "uom-conversions"
  | "suppliers"
  | "locations"
  | "categories"
  | "reason-codes"
  | "recipes";

export type MasterDataRecord = {
  id: string;
  active?: boolean;
  [key: string]: unknown;
};

export type PurchaseOrderLine = {
  id: string;
  itemId: string;
  qty: string;
  uomId: string;
  unitCost: string;
  defaultUnitCost: string | null;
  receivedQty?: string;
  rejectedQty?: string;
  remainingQty?: string;
  costOverrideReason: string | null;
  costOverriddenById: string | null;
  costOverriddenAt: string | null;
  costOverrideApprovedById: string | null;
  costOverrideApprovedAt: string | null;
  item?: MasterDataRecord;
  uom?: MasterDataRecord;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  locationId: string;
  status: string;
  expectedDate: string | null;
  remarks: string | null;
  supplier?: MasterDataRecord;
  location?: MasterDataRecord;
  lines?: PurchaseOrderLine[];
  receivings?: Receiving[];
  lineCount?: number;
  receivingCount?: number;
  createdAt: string;
};

export type ReceivingLine = {
  id: string;
  itemId: string;
  acceptedQty: string;
  rejectedQty: string;
  remarks: string | null;
  unitCost: string;
  item?: MasterDataRecord;
};

export type Receiving = {
  id: string;
  receivingNumber: string;
  purchaseOrderId: string | null;
  supplierId: string;
  locationId: string;
  status: string;
  drReference: string | null;
  invoiceReference: string | null;
  remarks: string | null;
  businessDate: string;
  supplier?: MasterDataRecord;
  location?: MasterDataRecord;
  purchaseOrder?: PurchaseOrder;
  lines: ReceivingLine[];
};

export type TransferLine = {
  id: string;
  itemId: string;
  requestedQty: string;
  pickedQty: string | null;
  receivedQty: string | null;
  unitCost: string | null;
  sourceQtyAvailableAtRequest?: string | null;
  sourceQtyRemainingAfterRequest?: string | null;
  sourceLowStockThreshold?: string | null;
  sourceLowStockAfterRequest?: boolean;
  item?: MasterDataRecord;
};

export type Transfer = {
  id: string;
  transferNumber: string;
  sourceLocationId: string;
  targetLocationId: string;
  status: string;
  neededDate: string | null;
  remarks: string | null;
  varianceNotes: string | null;
  requiresLowStockApproval?: boolean;
  lowStockApprovalReason?: string | null;
  sourceLocation?: MasterDataRecord;
  targetLocation?: MasterDataRecord;
  lines: TransferLine[];
  lineCount?: number;
  createdAt: string;
  updatedAt?: string;
};

export type SupplierItemCost = {
  supplierId: string;
  itemId: string;
  supplierItemId: string | null;
  unitCost: string | null;
  item?: MasterDataRecord | null;
  supplier?: MasterDataRecord | null;
};

export type BranchOperationLine = {
  id: string;
  itemId: string;
  qty?: string;
  countedQty?: string;
  systemQty?: string | null;
  varianceQty?: string | null;
  qtySold?: string;
  unitCost?: string | null;
  item?: MasterDataRecord;
};

export type BranchOperationRecord = {
  id: string;
  wastageNumber?: string;
  countNumber?: string;
  issueNumber?: string;
  batchNumber?: string;
  locationId: string;
  countType?: string;
  status?: string;
  businessDate: string;
  remarks?: string | null;
  reasonCode?: MasterDataRecord;
  location?: MasterDataRecord;
  lines: BranchOperationLine[];
  createdAt: string;
};

export type MenuPrice = {
  id: string;
  recipeId: string;
  outputItemId: string;
  locationId: string | null;
  channel: string;
  sellingPrice: string;
  targetFoodCostPercent: string | null;
  targetGrossMarginPercent: string | null;
  effectiveDate: string;
  effectiveEndDate: string | null;
  status: string;
  displayStatus?: string;
  expired?: boolean;
  notes: string | null;
  active: boolean;
  approvedAt: string | null;
  costPerServing: string;
  foodCostPercent: string;
  grossMarginPercent: string;
  grossProfit: string;
  totalRecipeCost: string;
  usableServingQty: string;
  costingWarnings?: string[];
  recipe?: MasterDataRecord;
  outputItem?: MasterDataRecord;
  location?: MasterDataRecord | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportCatalogItem = {
  key: string;
  label: string;
  description: string;
  format: "CSV";
  requiresDateRange?: boolean;
};

export type ReportRun = {
  id: string;
  reportKey: string;
  reportName: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  format: "CSV" | "XLSX" | "PDF";
  parameters: Record<string, unknown>;
  outputUrl: string | null;
  error: string | null;
  requestedById: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportDownload = {
  filename: string;
  contentType: string;
  content: string;
};

export type SyncBootstrap = {
  allowedEventTypes: string[];
  devices: SyncDevice[];
  locations: MasterDataRecord[];
  items: Array<{
    id: string;
    sku: string;
    name: string;
    itemType: string;
    baseUomCode: string;
    categoryName: string | null;
  }>;
  reasonCodes: MasterDataRecord[];
  serverTime: string;
};

export type SyncDevice = {
  id: string;
  deviceCode: string;
  name: string;
  type: string | null;
  locationId: string | null;
  locationCode?: string | null;
  locationName?: string | null;
  location?: { id: string; code: string; name: string } | null;
  active?: boolean;
  lastSeenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SyncEventRecord = {
  id: string;
  uuid: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "PROCESSED" | "ALREADY_PROCESSED" | "REJECTED";
  rejectionReason: string | null;
  processedAt: string | null;
};

export type SyncBatchRecord = {
  id: string;
  uuid: string;
  deviceId: string;
  locationId: string;
  submittedById?: string | null;
  status:
    | "RECEIVED"
    | "PROCESSING"
    | "COMPLETED"
    | "COMPLETED_WITH_REJECTIONS"
    | "FAILED";
  clientCreatedAt: string;
  appVersion: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  events: SyncEventRecord[];
};

export type SyncStatus = {
  pending: number;
  rejected: number;
  recentBatches: SyncBatchRecord[];
  serverTime: string;
};

export type AdminUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  active: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  restrictedAt: string | null;
  restrictedReason: string | null;
  restrictionCount: number;
  restrictionWindowStart: string | null;
  lockedAt: string | null;
  lockReason: string | null;
  accountStatus: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  locationIds: string[];
  locations: Array<{ id: string; code: string; name: string }>;
  createdAt: string;
  updatedAt: string;
};

export type AdminRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissionIds: string[];
  permissions: string[];
  userCount: number;
};

export type AdminPermission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
  key: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  module: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  userName: string;
  locationId: string | null;
  reasonCodeId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type OfflinePinStatus = {
  configured: boolean;
  updatedAt: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
};

type ApiListResponse<T> = {
  resource: string;
  data: T[];
};

type ApiMutationResponse<T> = {
  status: string;
  data: T;
};

const referenceCacheTtlMs = 5 * 60 * 1000;

export class ApiClient {
  constructor(private readonly accessToken: string) {}

  currentUser() {
    return this.request<AuthenticatedUser>("/auth/me");
  }

  offlinePinStatus() {
    return this.request<OfflinePinStatus>("/auth/offline-pin-status");
  }

  verifyOfflinePin(pin: string) {
    return this.request<OfflinePinStatus>("/auth/offline-pin/verify", {
      body: JSON.stringify({ pin }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  stockOnHand(locationId: string) {
    return this.request<ApiListResponse<StockOnHandRow>>(
      `/inventory/stock-on-hand?locationId=${encodeURIComponent(locationId)}`,
    );
  }

  inventoryMovements(locationId: string, take = 25) {
    return this.request<ApiListResponse<LedgerMovementRow>>(
      `/inventory/movements?locationId=${encodeURIComponent(locationId)}&take=${take}`,
    );
  }

  postLedgerEvent(payload: Record<string, unknown>) {
    return this.request<{ status: string; idempotent: boolean }>("/ledger/events", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  adjustmentRequests(locationId: string) {
    return this.request<ApiListResponse<AdjustmentRequest>>(
      `/inventory/adjustment-requests?locationId=${encodeURIComponent(
        locationId,
      )}&take=100`,
    );
  }

  createAdjustmentRequest(payload: Record<string, unknown>) {
    return this.request<AdjustmentRequest>("/inventory/adjustment-requests", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  approveAdjustmentRequest(id: string) {
    return this.request<AdjustmentRequest>(
      `/inventory/adjustment-requests/${id}/approve`,
      { method: "POST" },
    );
  }

  rejectAdjustmentRequest(id: string, reason: string) {
    return this.request<AdjustmentRequest>(
      `/inventory/adjustment-requests/${id}/reject`,
      {
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  }

  masterData<T extends MasterDataRecord>(resource: MasterDataResource) {
    return this.request<ApiListResponse<T>>(`/admin/${resource}?take=500`, {
      cacheTtlMs: referenceCacheTtlMs,
    });
  }

  createMasterData<T extends MasterDataRecord>(
    resource: MasterDataResource,
    payload: Record<string, unknown>,
  ) {
    return this.mutateMasterData<ApiMutationResponse<T>>(
      resource,
      `/admin/${resource}`,
      {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  }

  updateMasterData<T extends MasterDataRecord>(
    resource: MasterDataResource,
    id: string,
    payload: Record<string, unknown>,
  ) {
    return this.mutateMasterData<ApiMutationResponse<T>>(
      resource,
      `/admin/${resource}/${id}`,
      {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
    );
  }

  deactivateMasterData<T extends MasterDataRecord>(
    resource: MasterDataResource,
    id: string,
  ) {
    return this.mutateMasterData<ApiMutationResponse<T>>(
      resource,
      `/admin/${resource}/${id}/deactivate`,
      { method: "POST" },
    );
  }

  recordRecipeYieldObservation(
    recipeId: string,
    payload: Record<string, unknown>,
  ) {
    return this.mutateMasterData<ApiMutationResponse<MasterDataRecord>>(
      "recipes",
      `/admin/recipes/${recipeId}/yield-observations`,
      {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  }

  menuPrices() {
    return this.request<ApiListResponse<MenuPrice>>("/menu-pricing?take=500");
  }

  createMenuPrice(payload: Record<string, unknown>) {
    return this.request<MenuPrice>("/menu-pricing", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  updateMenuPrice(id: string, payload: Record<string, unknown>) {
    return this.request<MenuPrice>(`/menu-pricing/${id}`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  }

  submitMenuPrice(id: string) {
    return this.request<MenuPrice>(`/menu-pricing/${id}/submit`, {
      method: "POST",
    });
  }

  approveMenuPrice(id: string) {
    return this.request<MenuPrice>(`/menu-pricing/${id}/approve`, {
      method: "POST",
    });
  }

  cloneMenuPrice(id: string) {
    return this.request<MenuPrice>(`/menu-pricing/${id}/clone`, {
      method: "POST",
    });
  }

  purchaseOrders() {
    return this.request<ApiListResponse<PurchaseOrder>>(
      "/purchasing/purchase-orders?take=500",
    );
  }

  supplierItemCost(supplierId: string, itemId: string) {
    return this.request<SupplierItemCost>(
      `/purchasing/supplier-item-cost?supplierId=${encodeURIComponent(
        supplierId,
      )}&itemId=${encodeURIComponent(itemId)}`,
    );
  }

  purchaseOrder(id: string) {
    return this.request<PurchaseOrder>(`/purchasing/purchase-orders/${id}`);
  }

  createPurchaseOrder(payload: Record<string, unknown>) {
    return this.request<PurchaseOrder>("/purchasing/purchase-orders", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  updatePurchaseOrder(id: string, payload: Record<string, unknown>) {
    return this.request<PurchaseOrder>(`/purchasing/purchase-orders/${id}`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  }

  submitPurchaseOrder(id: string) {
    return this.request<PurchaseOrder>(
      `/purchasing/purchase-orders/${id}/submit`,
      { method: "POST" },
    );
  }

  approvePurchaseOrder(id: string) {
    return this.request<PurchaseOrder>(
      `/purchasing/purchase-orders/${id}/approve`,
      {
        body: "{}",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  }

  rejectPurchaseOrder(id: string, remarks: string) {
    return this.request<PurchaseOrder>(
      `/purchasing/purchase-orders/${id}/reject`,
      {
        body: JSON.stringify({ remarks }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  }

  closePurchaseOrderBalance(id: string, remarks: string) {
    return this.request<PurchaseOrder>(
      `/purchasing/purchase-orders/${id}/close-balance`,
      {
        body: JSON.stringify({ remarks }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  }

  createReceiving(payload: Record<string, unknown>) {
    return this.request<Receiving>("/purchasing/receivings", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  transfers() {
    return this.request<ApiListResponse<Transfer>>("/transfers?take=500");
  }

  createTransfer(payload: Record<string, unknown>) {
    return this.request<Transfer>("/transfers", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  approveTransfer(id: string) {
    return this.request<Transfer>(`/transfers/${id}/approve`, {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  dispatchTransfer(id: string, payload: Record<string, unknown>) {
    return this.request<Transfer>(`/transfers/${id}/dispatch`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  receiveTransfer(id: string, payload: Record<string, unknown>) {
    return this.request<Transfer>(`/transfers/${id}/receive`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  resolveTransferVariance(id: string, payload: Record<string, unknown>) {
    return this.request<Transfer>(`/transfers/${id}/resolve-variance`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  branchWastage(locationId: string) {
    return this.request<ApiListResponse<BranchOperationRecord>>(
      `/branch/wastage?locationId=${encodeURIComponent(locationId)}&take=25`,
    );
  }

  createBranchWastage(payload: Record<string, unknown>) {
    return this.request<BranchOperationRecord>("/branch/wastage", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  branchStockCounts(locationId: string) {
    return this.request<ApiListResponse<BranchOperationRecord>>(
      `/branch/stock-counts?locationId=${encodeURIComponent(locationId)}&take=25`,
    );
  }

  submitBranchStockCount(payload: Record<string, unknown>) {
    return this.request<BranchOperationRecord>("/branch/stock-counts", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  branchIssues(locationId: string) {
    return this.request<ApiListResponse<BranchOperationRecord>>(
      `/branch/issues?locationId=${encodeURIComponent(locationId)}&take=25`,
    );
  }

  createBranchIssue(payload: Record<string, unknown>) {
    return this.request<BranchOperationRecord>("/branch/issues", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  branchSalesBatches(locationId: string) {
    return this.request<ApiListResponse<BranchOperationRecord>>(
      `/branch/sales-batches?locationId=${encodeURIComponent(locationId)}&take=25`,
    );
  }

  createBranchSalesBatch(payload: Record<string, unknown>) {
    return this.request<BranchOperationRecord>("/branch/sales-batches", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  reportCatalog() {
    return this.request<ApiListResponse<ReportCatalogItem>>("/reports/catalog", {
      cacheTtlMs: referenceCacheTtlMs,
    });
  }

  reportRuns() {
    return this.request<ApiListResponse<ReportRun>>("/reports/runs?take=100");
  }

  runReport(payload: Record<string, unknown>) {
    return this.request<ReportRun>("/reports/runs", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  downloadReportRun(id: string) {
    return this.request<ReportDownload>(`/reports/runs/${id}/download`);
  }

  syncBootstrap() {
    return this.request<{ resource: string; data: SyncBootstrap }>(
      "/sync/bootstrap",
    );
  }

  syncStatus() {
    return this.request<{ resource: string; data: SyncStatus }>("/sync/status");
  }

  syncBatches() {
    return this.request<ApiListResponse<SyncBatchRecord>>(
      "/sync/batches?take=50",
    );
  }

  submitSyncBatch(payload: Record<string, unknown>) {
    return this.request<{
      status: string;
      duplicateEventUuids?: string[];
      idempotent: boolean;
      batch: SyncBatchRecord;
    }>("/sync/batch", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  adminUsers() {
    return this.request<ApiListResponse<AdminUser>>("/admin/users?take=500");
  }

  adminSyncDevices() {
    return this.request<ApiListResponse<SyncDevice>>(
      "/admin/sync-devices?take=500",
    );
  }

  createAdminSyncDevice(payload: Record<string, unknown>) {
    return this.request<SyncDevice>("/admin/sync-devices", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  updateAdminSyncDevice(id: string, payload: Record<string, unknown>) {
    return this.request<SyncDevice>(`/admin/sync-devices/${id}`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  }

  deactivateAdminSyncDevice(id: string) {
    return this.request<SyncDevice>(`/admin/sync-devices/${id}/deactivate`, {
      method: "POST",
    });
  }

  createAdminUser(payload: Record<string, unknown>) {
    return this.request<AdminUser>("/admin/users", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  updateAdminUser(id: string, payload: Record<string, unknown>) {
    return this.request<AdminUser>(`/admin/users/${id}`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  }

  deactivateAdminUser(id: string) {
    return this.request<AdminUser>(`/admin/users/${id}/deactivate`, {
      method: "POST",
    });
  }

  resetAdminUserPassword(id: string) {
    return this.request<AdminUser>(`/admin/users/${id}/reset-password`, {
      method: "POST",
    });
  }

  unrestrictAdminUser(id: string) {
    return this.request<AdminUser>(`/admin/users/${id}/unrestrict`, {
      method: "POST",
    });
  }

  unlockAdminUser(id: string) {
    return this.request<AdminUser>(`/admin/users/${id}/unlock`, {
      method: "POST",
    });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.request<AuthenticatedUser>("/auth/change-password", {
      body: JSON.stringify({ currentPassword, newPassword }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  adminRoles() {
    return this.request<ApiListResponse<AdminRole>>("/admin/roles");
  }

  updateAdminRole(id: string, payload: Record<string, unknown>) {
    return this.request<AdminRole>(`/admin/roles/${id}`, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  }

  adminPermissions() {
    return this.request<ApiListResponse<AdminPermission>>("/admin/permissions");
  }

  auditLogs() {
    return this.request<ApiListResponse<AuditLog>>(
      "/admin/audit-logs?take=100",
    );
  }

  adminOfflinePin() {
    return this.request<OfflinePinStatus>("/admin/offline-pin");
  }

  resetAdminOfflinePin(pin: string) {
    return this.request<OfflinePinStatus>("/admin/offline-pin/reset", {
      body: JSON.stringify({ pin }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  private async mutateMasterData<T>(
    resource: MasterDataResource,
    path: string,
    init: RequestInit,
  ) {
    const response = await this.request<T>(path, init);
    await deleteCachedValue(this.cacheKey(`/admin/${resource}?take=500`));

    return response;
  }

  private async request<T>(
    path: string,
    init?: RequestInit & { cacheTtlMs?: number },
  ) {
    const { cacheTtlMs, ...fetchInit } = init ?? {};
    const method = fetchInit.method ?? "GET";
    const cacheKey = `api:${path}`;

    if (method === "GET" && cacheTtlMs) {
      const cached = await this.freshCachedValue<T>(cacheKey, cacheTtlMs);

      if (cached) {
        return cached;
      }
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...fetchInit,
      cache: "no-store",
      headers: {
        ...(fetchInit.headers ?? {}),
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(await this.toErrorMessage(response));
    }

    const body = (await response.json()) as T;

    if (method === "GET" && cacheTtlMs) {
      await setCachedValue(cacheKey, body);
    }

    return body;
  }

  private cacheKey(path: string) {
    return `api:${path}`;
  }

  private async freshCachedValue<T>(key: string, ttlMs: number) {
    const cached = await getCachedValue<T>(key);

    if (!cached) {
      return null;
    }

    const ageMs = Date.now() - new Date(cached.updatedAt).getTime();

    return ageMs <= ttlMs ? cached.value : null;
  }

  private async toErrorMessage(response: Response) {
    try {
      const body = (await response.json()) as { message?: string | string[] };
      const message = body.message;

      if (Array.isArray(message)) {
        return message.join(", ");
      }

      return message ?? `Request failed with status ${response.status}.`;
    } catch {
      return `Request failed with status ${response.status}.`;
    }
  }
}
