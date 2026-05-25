"use client";

import { ApiClient, TOKEN_KEY, type MasterDataResource } from "./api-client";
import { setCachedValue } from "./offline-db";

export const OFFLINE_REFRESH_KEY = "ogfi.offlineRefresh.lastCompletedAt";

const masterResources: MasterDataResource[] = [
  "items",
  "uoms",
  "uom-conversions",
  "suppliers",
  "supplier-items",
  "locations",
  "categories",
  "reason-codes",
  "recipes",
];

export async function refreshOfflineData() {
  const token = window.localStorage.getItem(TOKEN_KEY);

  if (!token || !window.navigator.onLine) {
    return null;
  }

  try {
    const client = new ApiClient(token);
    const user = await client.currentUser();

    await Promise.allSettled([
      client.syncBootstrap(),
      client.syncStatus(),
      client.syncBatches(),
      client.purchaseOrders(),
      client.transfers(),
      client.menuPrices(),
      client.reportCatalog(),
      ...masterResources.map((resource) => client.masterData(resource)),
      ...user.locationIds.flatMap((locationId) => [
        client.stockOnHand(locationId),
        client.inventoryMovements(locationId, 100),
        client.branchWastage(locationId),
        client.branchStockCounts(locationId),
        client.branchIssues(locationId),
        client.branchSalesBatches(locationId),
      ]),
    ]);

    const completedAt = new Date().toISOString();
    window.localStorage.setItem(OFFLINE_REFRESH_KEY, completedAt);
    await setCachedValue("offline:last-refresh", completedAt);
    window.dispatchEvent(new CustomEvent("ogfi:offline-refresh-complete"));

    return completedAt;
  } catch {
    return null;
  }
}

export function getLastOfflineRefresh() {
  return window.localStorage.getItem(OFFLINE_REFRESH_KEY);
}
