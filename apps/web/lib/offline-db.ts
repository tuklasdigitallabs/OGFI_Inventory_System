"use client";

import type { LocalSyncEvent } from "./offline-types";
import {
  decryptOfflineValue,
  encryptOfflineValue,
  hasOfflinePin,
  isOfflineUnlocked,
} from "./offline-crypto";

const databaseName = "ogfi-offline";
const databaseVersion = 1;
const cacheStore = "cache";
const queueStore = "syncQueue";

type CacheRecord<T> = {
  key: string;
  updatedAt: string;
  value: T;
};

type QueueRecord = LocalSyncEvent | { uuid: string; payload: unknown };

function openOfflineDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(cacheStore)) {
        db.createObjectStore(cacheStore, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(queueStore)) {
        db.createObjectStore(queueStore, { keyPath: "uuid" });
      }
    };
  });
}

async function store<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openOfflineDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function getCachedValue<T>(key: string) {
  const record = await store<CacheRecord<T> | undefined>(
    cacheStore,
    "readonly",
    (objectStore) => objectStore.get(key),
  );

  if (!record) {
    return null;
  }

  return {
    ...record,
    value: await decryptOfflineValue<T>(record.value),
  };
}

export async function setCachedValue<T>(key: string, value: T) {
  if (hasOfflinePin() && !isOfflineUnlocked()) {
    return;
  }

  const record: CacheRecord<T> = {
    key,
    updatedAt: new Date().toISOString(),
    value: (hasOfflinePin() ? await encryptOfflineValue(value) : value) as T,
  };

  await store<IDBValidKey>(cacheStore, "readwrite", (objectStore) =>
    objectStore.put(record),
  );
}

export async function deleteCachedValue(key: string) {
  await store<undefined>(cacheStore, "readwrite", (objectStore) =>
    objectStore.delete(key),
  );
}

export async function getOfflineQueue() {
  await migrateLocalStorageQueue();

  const records = await store<QueueRecord[]>(
    queueStore,
    "readonly",
    (objectStore) => objectStore.getAll(),
  );

  return Promise.all(records.map(decodeQueueRecord));
}

export async function saveOfflineQueue(events: LocalSyncEvent[]) {
  if (!navigator.onLine && hasOfflinePin() && !isOfflineUnlocked()) {
    window.dispatchEvent(new CustomEvent("ogfi:offline-unlock-required"));
    throw new Error("Unlock offline storage before editing the sync queue.");
  }

  const records = events;
  const db = await openOfflineDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(queueStore, "readwrite");
    const objectStore = transaction.objectStore(queueStore);

    objectStore.clear();
    for (const record of records) {
      objectStore.put(record);
    }

    transaction.oncomplete = () => {
      db.close();
      broadcastOfflineQueueChange();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function offlineQueueCount() {
  await migrateLocalStorageQueue();

  return store<number>(queueStore, "readonly", (objectStore) =>
    objectStore.count(),
  );
}

export function broadcastOfflineQueueChange() {
  window.dispatchEvent(new CustomEvent("ogfi:offline-queue-change"));
}

export async function clearOfflineData() {
  const db = await openOfflineDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([cacheStore, queueStore], "readwrite");

    transaction.objectStore(cacheStore).clear();
    transaction.objectStore(queueStore).clear();
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });

  if ("caches" in window) {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  }

  broadcastOfflineQueueChange();
}

async function decodeQueueRecord(record: QueueRecord) {
  if ("payload" in record) {
    return decryptOfflineValue<LocalSyncEvent>(record.payload);
  }

  return record;
}

async function migrateLocalStorageQueue() {
  const localQueue = window.localStorage.getItem("ogfi.offlineSyncQueue");

  if (!localQueue) {
    return;
  }

  try {
    const parsed = JSON.parse(localQueue) as LocalSyncEvent[];

    if (Array.isArray(parsed) && parsed.length > 0) {
      const existing = await store<LocalSyncEvent[]>(
        queueStore,
        "readonly",
        (objectStore) => objectStore.getAll(),
      );
      const existingIds = new Set(existing.map((event) => event.uuid));

      await saveOfflineQueue([
        ...existing,
        ...parsed.filter((event) => !existingIds.has(event.uuid)),
      ]);
    }
  } catch {
    // Ignore malformed legacy queue data.
  } finally {
    window.localStorage.removeItem("ogfi.offlineSyncQueue");
  }
}
