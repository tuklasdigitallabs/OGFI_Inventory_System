"use client";

const pinRecordKey = "ogfi.offline.pin";
const sessionTimeoutMs = 15 * 60 * 1000;

type PinRecord = {
  policyUpdatedAt: string | null;
  salt: string;
  userId: string;
  verifier: string;
  version: 1;
};

let encryptionKey: CryptoKey | null = null;

export function hasOfflinePin() {
  return Boolean(readPinRecord());
}

export function offlinePinMatchesPolicy(policyUpdatedAt: string | null) {
  const record = readPinRecord();

  return Boolean(record) && record?.policyUpdatedAt === policyUpdatedAt;
}

export function isOfflineUnlocked() {
  return Boolean(encryptionKey) && !isOfflineSessionExpired();
}

export function isOfflineSessionExpired() {
  const lastActiveAt = Number(
    window.sessionStorage.getItem("ogfi.offline.lastActiveAt"),
  );

  return (
    Number.isFinite(lastActiveAt) &&
    Date.now() - lastActiveAt > sessionTimeoutMs
  );
}

export function touchOfflineSession() {
  if (encryptionKey) {
    window.sessionStorage.setItem(
      "ogfi.offline.lastActiveAt",
      String(Date.now()),
    );
  }
}

export function lockOfflineSession() {
  encryptionKey = null;
  window.sessionStorage.removeItem("ogfi.offline.lastActiveAt");
  window.dispatchEvent(new CustomEvent("ogfi:offline-lock"));
}

export function clearOfflinePin() {
  lockOfflineSession();
  window.localStorage.removeItem(pinRecordKey);
}

export async function setupOfflinePin(
  userId: string,
  pin: string,
  policyUpdatedAt: string | null,
) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await deriveBytes(pin, salt, ["verify"]);

  window.localStorage.setItem(
    pinRecordKey,
    JSON.stringify({
      policyUpdatedAt,
      salt: toBase64(salt),
      userId,
      verifier: toBase64(verifier),
      version: 1,
    } satisfies PinRecord),
  );

  encryptionKey = await deriveEncryptionKey(pin, salt);
  touchOfflineSession();
}

export async function unlockOfflinePin(pin: string) {
  const record = readPinRecord();

  if (!record) {
    throw new Error("Offline PIN is not configured.");
  }

  const salt = fromBase64(record.salt);
  const verifier = await deriveBytes(pin, salt, ["verify"]);

  if (toBase64(verifier) !== record.verifier) {
    throw new Error("Invalid offline PIN.");
  }

  encryptionKey = await deriveEncryptionKey(pin, salt);
  touchOfflineSession();
}

export async function encryptOfflineValue(value: unknown) {
  if (!encryptionKey) {
    throw new Error("Unlock offline storage before caching confidential data.");
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    encoded,
  );

  return {
    encrypted: true,
    iv: toBase64(iv),
    value: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptOfflineValue<T>(record: unknown) {
  if (!isEncryptedRecord(record)) {
    return record as T;
  }

  if (!encryptionKey) {
    throw new Error("Offline storage is locked.");
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(record.iv) },
    encryptionKey,
    fromBase64(record.value),
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export function offlinePinUserId() {
  return readPinRecord()?.userId ?? null;
}

function readPinRecord() {
  const raw = window.localStorage.getItem(pinRecordKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PinRecord;
  } catch {
    return null;
  }
}

async function deriveEncryptionKey(pin: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      hash: "SHA-256",
      iterations: 210000,
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
    },
    baseKey,
    { length: 256, name: "AES-GCM" },
    false,
    ["decrypt", "encrypt"],
  );
}

async function deriveBytes(pin: string, salt: Uint8Array, purpose: string[]) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode([...purpose, pin].join(":")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations: 210000,
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
    },
    baseKey,
    256,
  );

  return new Uint8Array(bits);
}

function isEncryptedRecord(
  value: unknown,
): value is { encrypted: true; iv: string; value: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "encrypted" in value &&
    "iv" in value &&
    "value" in value
  );
}

function toBase64(value: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < value.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...value.subarray(offset, offset + chunkSize),
    );
  }

  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}
