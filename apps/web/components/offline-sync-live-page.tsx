"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApiClient,
  getSessionAccessToken,
  type AuthenticatedUser,
  type SyncBatchRecord,
  type SyncBootstrap,
  type SyncEventRecord,
  type SyncStatus,
} from "@/lib/api-client";
import { Icon } from "@/lib/icons";
import {
  broadcastOfflineQueueChange,
  getOfflineQueue,
  saveOfflineQueue,
} from "@/lib/offline-db";
import type { LocalSyncEvent } from "@/lib/offline-types";
import type { Kpi, Screen } from "@/lib/screens";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

type OfflineSyncLivePageProps = {
  screen: Screen;
};

type SyncForm = {
  adjustmentDirection: "IN" | "OUT";
  businessDate: string;
  deviceId: string;
  eventType: string;
  itemId: string;
  locationId: string;
  qty: string;
  reasonCodeId: string;
  remarks: string;
  unitCostAtTime: string;
};

const emptyForm: SyncForm = {
  adjustmentDirection: "OUT",
  businessDate: new Date().toISOString().slice(0, 10),
  deviceId: "",
  eventType: "ADJUSTMENT",
  itemId: "",
  locationId: "",
  qty: "",
  reasonCodeId: "",
  remarks: "",
  unitCostAtTime: "0",
};

export function OfflineSyncLivePage({ screen }: OfflineSyncLivePageProps) {
  const [batches, setBatches] = useState<SyncBatchRecord[]>([]);
  const [bootstrap, setBootstrap] = useState<SyncBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SyncForm>(emptyForm);
  const [localQueue, setLocalQueue] = useState<LocalSyncEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const canSubmitSync = user?.permissions.includes("sync:submit") ?? false;

  useEffect(() => {
    function refreshQueue() {
      void getOfflineQueue()
        .then((queue) => {
          setLocalQueue(queue);
          setError(null);
        })
        .catch((queueError) =>
          setError(
            queueError instanceof Error
              ? queueError.message
              : "Unlock offline storage to load queued events.",
          ),
        );
    }

    refreshQueue();
    window.addEventListener("ogfi:offline-queue-change", refreshQueue);

    return () =>
      window.removeEventListener("ogfi:offline-queue-change", refreshQueue);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = getSessionAccessToken();

      if (!token) {
        setError("Sign in again to load offline sync.");
        setLoading(false);
        return;
      }

      try {
        const client = new ApiClient(token);
        const [
          currentUser,
          bootstrapResponse,
          statusResponse,
          batchesResponse,
        ] =
          await Promise.all([
            client.currentUser(),
            client.syncBootstrap(),
            client.syncStatus(),
            client.syncBatches(),
          ]);

        if (!cancelled) {
          setUser(currentUser);
          setBootstrap(bootstrapResponse.data);
          setStatus(statusResponse.data);
          setBatches(batchesResponse.data);
          setForm((current) => ({
            ...current,
            deviceId: defaultDeviceId(
              bootstrapResponse.data,
              bootstrapResponse.data.locations[0]?.id ?? current.locationId,
            ),
            eventType:
              bootstrapResponse.data.allowedEventTypes[0] ?? current.eventType,
            itemId: bootstrapResponse.data.items[0]?.id ?? current.itemId,
            locationId:
              bootstrapResponse.data.locations[0]?.id ?? current.locationId,
          }));
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load offline sync.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(
    () => buildSyncKpis(localQueue, status, loading),
    [loading, localQueue, status],
  );
  const selectedItem = bootstrap?.items.find((item) => item.id === form.itemId);
  const selectedEvent = eventFields(form.eventType);
  const selectedQueue = localQueue.filter(
    (event) =>
      eventLocationId(event) === form.locationId &&
      event.deviceId === form.deviceId,
  );
  const deviceOptions = useMemo(
    () =>
      bootstrap?.devices.filter(
        (device) => !device.locationId || device.locationId === form.locationId,
      ) ?? [],
    [bootstrap, form.locationId],
  );

  async function saveQueue(nextQueue: LocalSyncEvent[]) {
    await saveOfflineQueue(nextQueue);
    setLocalQueue(nextQueue);
    broadcastOfflineQueueChange();
  }

  async function addLocalEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmitSync) {
      setError("You do not have permission to queue offline sync events.");
      return;
    }

    if (!form.locationId || !form.deviceId || !form.itemId) {
      setError("Select a location, device, and item before queuing an event.");
      return;
    }

    if (form.eventType === "STOCK_COUNT") {
      setError(
        "Stock Count is online-only from Store Operations because it requires current server balances.",
      );
      return;
    }

    if (!form.qty) {
      setError(`Enter ${selectedEvent.qtyLabel.toLowerCase()}.`);
      return;
    }

    if (form.eventType === "WASTAGE" && !form.reasonCodeId) {
      setError("Select a wastage reason.");
      return;
    }

    const qty = Number(form.qty);
    const qtyIn =
      form.eventType === "ADJUSTMENT" && form.adjustmentDirection === "IN"
        ? String(qty)
        : "";
    const qtyOut =
      form.eventType === "ADJUSTMENT" && form.adjustmentDirection === "IN"
        ? ""
        : String(qty);
    const nextEvent: LocalSyncEvent = {
      uuid: crypto.randomUUID(),
      deviceId: form.deviceId,
      eventType: form.eventType,
      itemId: form.itemId,
      qtyIn,
      qtyOut,
      reasonCodeId: form.reasonCodeId || undefined,
      remarks: form.remarks || undefined,
      unitCostAtTime: form.unitCostAtTime,
      businessDate: form.businessDate,
      status: "QUEUED",
      rejectionReason: null,
      locationId: form.locationId,
    };

    try {
      await saveQueue([...localQueue, nextEvent]);
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to persist the offline event.",
      );
    }
  }

  async function submitQueue() {
    if (!canSubmitSync) {
      setError("You do not have permission to submit offline sync batches.");
      return;
    }

    if (!form.locationId || !form.deviceId) {
      setError("Select a location and device before submitting the queue.");
      return;
    }

    if (selectedQueue.length === 0) {
      setError("No queued events for the selected location and device.");
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();
      const result = await client.submitSyncBatch({
        uuid: crypto.randomUUID(),
        deviceId: form.deviceId,
        locationId: form.locationId,
        clientCreatedAt: new Date().toISOString(),
        appVersion: "web-local",
        events: selectedQueue.map((event) => ({
          uuid: event.uuid,
          eventType: event.eventType,
          payload: {
            itemId: event.itemId,
            qtyIn: event.qtyIn ? Number(event.qtyIn) : undefined,
            qtyOut: event.qtyOut ? Number(event.qtyOut) : undefined,
            unitCostAtTime: Number(event.unitCostAtTime),
            businessDate: event.businessDate,
            reasonCodeId: event.reasonCodeId,
            metadata: {
              queuedFrom: "offline-sync-page",
              remarks: event.remarks,
            },
          },
        })),
      });
      const rejectedByUuid = new Map(
        result.batch.events
          .filter((event) => event.status === "REJECTED")
          .map((event) => [event.uuid, event.rejectionReason ?? "Rejected"]),
      );
      const remainingQueue = localQueue
        .filter(
          (event) =>
            eventLocationId(event) !== form.locationId ||
            event.deviceId !== form.deviceId,
        )
        .concat(
          selectedQueue
            .filter((event) => rejectedByUuid.has(event.uuid))
            .map((event) => ({
              ...event,
              status: "REJECTED" as const,
              rejectionReason: rejectedByUuid.get(event.uuid) ?? "Rejected",
            })),
        );

      await saveQueue(remainingQueue);
      const [nextStatus, nextBatches] = await Promise.all([
        client.syncStatus(),
        client.syncBatches(),
      ]);
      setStatus(nextStatus.data);
      setBatches(nextBatches.data);
      setError(
        rejectedByUuid.size > 0
          ? "Some events were rejected. Edit the rejected local rows and submit again."
          : null,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit sync queue.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateLocalEvent(uuid: string, patch: Partial<LocalSyncEvent>) {
    const nextQueue = localQueue.map((event) =>
      event.uuid === uuid
        ? {
            ...event,
            ...patch,
            rejectionReason: null,
            status: "QUEUED" as const,
          }
        : event,
    );

    try {
      await saveQueue(nextQueue);
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update the offline event.",
      );
    }
  }

  async function removeLocalEvent(uuid: string) {
    try {
      await saveQueue(localQueue.filter((event) => event.uuid !== uuid));
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to remove the offline event.",
      );
    }
  }

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-green-50 p-3 text-og-green">
            <Icon name={screen.icon} size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-og-gray">
              {screen.eyebrow}
            </p>
            <h1 className="font-poppins text-2xl font-semibold text-og-dark sm:text-[28px]">
              {screen.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-og-gray">
              {screen.description}
            </p>
          </div>
        </div>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || saving || !canSubmitSync}
          type="button"
          onClick={submitQueue}
        >
          <Icon name="CloudUpload" size={18} />
          Submit Queue
        </button>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      {error ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-og-error">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form className="og-card flex flex-col gap-4" onSubmit={addLocalEvent}>
          <div>
            <h2 className="font-poppins text-lg font-semibold text-og-dark">
              Queue Offline Event
            </h2>
            <p className="mt-1 text-sm text-og-gray">
              Events stay in this browser until submitted successfully.
            </p>
          </div>

          <SelectField
            disabled={loading || saving || !canSubmitSync}
            label="Location"
            value={form.locationId}
            options={
              bootstrap?.locations.map((location) => ({
                label: `${text(location.code)} - ${text(location.name)}`,
                value: text(location.id),
              })) ?? []
            }
            onChange={(locationId) =>
              setForm({
                ...form,
                deviceId: defaultDeviceId(bootstrap, locationId),
                locationId,
              })
            }
          />
          <SelectField
            disabled={
              loading || saving || !canSubmitSync || deviceOptions.length === 0
            }
            label="Registered device"
            value={form.deviceId}
            options={deviceOptions.map((device) => ({
              label: `${device.deviceCode} - ${device.name}`,
              value: device.deviceCode,
            }))}
            onChange={(deviceId) => setForm({ ...form, deviceId })}
          />
          <SelectField
            disabled={loading || saving || !canSubmitSync}
            label="Event type"
            value={form.eventType}
            options={
              bootstrap?.allowedEventTypes.map((eventType) => ({
                label: eventType,
                value: eventType,
              })) ?? []
            }
            onChange={(eventType) => setForm({ ...form, eventType })}
          />

          {form.eventType === "STOCK_COUNT" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-[#8a5200]">
              Stock Count and EOD Count are posted from Store Operations while
              online because they compare against current server balances.
            </div>
          ) : null}

          <SelectField
            disabled={loading || saving || !canSubmitSync}
            label="Item"
            value={form.itemId}
            options={
              bootstrap?.items.map((item) => ({
                label: `${item.sku} - ${item.name}`,
                value: item.id,
              })) ?? []
            }
            onChange={(itemId) => setForm({ ...form, itemId })}
          />

          {form.eventType === "ADJUSTMENT" ? (
            <SelectField
              disabled={loading || saving || !canSubmitSync}
              label="Adjustment direction"
              value={form.adjustmentDirection}
              options={[
                { label: "Qty out", value: "OUT" },
                { label: "Qty in", value: "IN" },
              ]}
              onChange={(adjustmentDirection) =>
                setForm({
                  ...form,
                  adjustmentDirection: adjustmentDirection as "IN" | "OUT",
                })
              }
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              disabled={loading || saving || !canSubmitSync}
              label={`${selectedEvent.qtyLabel}${selectedItem ? ` (${selectedItem.baseUomCode})` : ""}`}
              type="number"
              value={form.qty}
              onChange={(qty) => setForm({ ...form, qty })}
            />
            <ReadOnlyField
              label="UOM"
              value={selectedItem?.baseUomCode ?? "-"}
            />
          </div>

          {form.eventType === "WASTAGE" ? (
            <SelectField
              disabled={loading || saving || !canSubmitSync}
              label="Reason"
              value={form.reasonCodeId}
              options={wastageReasons(bootstrap).map((reason) => ({
                label: `${text(reason.code)} - ${text(reason.description ?? reason.name)}`,
                value: text(reason.id),
              }))}
              onChange={(reasonCodeId) => setForm({ ...form, reasonCodeId })}
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {form.eventType === "ADJUSTMENT" ? (
              <TextField
                disabled={loading || saving || !canSubmitSync}
                label="Unit cost"
                type="number"
                value={form.unitCostAtTime}
                onChange={(unitCostAtTime) =>
                  setForm({ ...form, unitCostAtTime })
                }
              />
            ) : null}
            <TextField
              disabled={loading || saving || !canSubmitSync}
              label="Business date"
              type="date"
              value={form.businessDate}
              onChange={(businessDate) => setForm({ ...form, businessDate })}
            />
          </div>

          {selectedEvent.showRemarks ? (
            <TextAreaField
              disabled={loading || saving || !canSubmitSync}
              label="Remarks"
              value={form.remarks}
              onChange={(remarks) => setForm({ ...form, remarks })}
            />
          ) : null}

          <button
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || saving || form.eventType === "STOCK_COUNT"}
            type="submit"
          >
            <Icon name="FilePlus2" size={18} />
            Add to Queue
          </button>
        </form>

        <section className="og-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-og-line p-4">
            <div className="flex items-center gap-2">
              <Icon name="Database" size={20} className="text-og-green" />
              <h2 className="font-poppins text-xl font-semibold text-og-dark">
                Local Queue
              </h2>
            </div>
            <span className="text-xs font-semibold text-og-gray">
              {selectedQueue.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {[
                    "Event",
                    "Item",
                    "Qty In",
                    "Qty Out",
                    "Unit Cost",
                    "Status",
                    "Actions",
                  ].map((column) => (
                    <th className="og-table-header" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedQueue.length === 0 ? (
                  <tr className="border-t border-og-line">
                    <td
                      className="og-table-cell py-8 text-center text-og-gray"
                      colSpan={7}
                    >
                      No local events queued for this location and device
                    </td>
                  </tr>
                ) : null}
                {selectedQueue.map((event) => (
                  <tr className="border-t border-og-line" key={event.uuid}>
                    <td className="og-table-cell">{event.eventType}</td>
                    <td className="og-table-cell">
                      {itemLabel(bootstrap, event.itemId)}
                    </td>
                    <td className="og-table-cell">
                      <InlineNumber
                        value={event.qtyIn}
                        onChange={(qtyIn) =>
                          updateLocalEvent(event.uuid, { qtyIn })
                        }
                      />
                    </td>
                    <td className="og-table-cell">
                      <InlineNumber
                        value={event.qtyOut}
                        onChange={(qtyOut) =>
                          updateLocalEvent(event.uuid, { qtyOut })
                        }
                      />
                    </td>
                    <td className="og-table-cell">
                      <InlineNumber
                        value={event.unitCostAtTime}
                        onChange={(unitCostAtTime) =>
                          updateLocalEvent(event.uuid, { unitCostAtTime })
                        }
                      />
                    </td>
                    <td className="og-table-cell">
                      <StatusBadge value={event.status} />
                      {event.rejectionReason ? (
                        <p className="mt-1 text-xs text-og-error">
                          {event.rejectionReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="og-table-cell">
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-red-50 hover:text-og-error"
                        type="button"
                        onClick={() => removeLocalEvent(event.uuid)}
                      >
                        <Icon name="X" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="og-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-og-line p-4">
          <div className="flex items-center gap-2">
            <Icon name="CloudSync" size={20} className="text-og-green" />
            <h2 className="font-poppins text-xl font-semibold text-og-dark">
              Sync Batches
            </h2>
          </div>
          <span className="text-xs font-semibold text-og-gray">
            {batches.length} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {["Device", "Location", "Events", "Received", "Status"].map(
                  (column) => (
                    <th className="og-table-header" key={column}>
                      {column}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-og-line">
                  <td
                    className="og-table-cell py-8 text-center text-og-gray"
                    colSpan={5}
                  >
                    Loading sync batches
                  </td>
                </tr>
              ) : null}
              {!loading && batches.length === 0 ? (
                <tr className="border-t border-og-line">
                  <td
                    className="og-table-cell py-8 text-center text-og-gray"
                    colSpan={5}
                  >
                    No sync batches received
                  </td>
                </tr>
              ) : null}
              {!loading
                ? batches.map((batch) => (
                    <tr
                      className="border-t border-og-line hover:bg-[#fff5e4]"
                      key={batch.id}
                    >
                      <td className="og-table-cell">{batch.deviceId}</td>
                      <td className="og-table-cell">
                        {locationLabel(bootstrap, batch.locationId)}
                      </td>
                      <td className="og-table-cell">
                        {formatInteger(batch.events.length)}
                      </td>
                      <td className="og-table-cell">
                        {formatDateTime(batch.createdAt)}
                      </td>
                      <td className="og-table-cell">
                        <StatusBadge value={batch.status} />
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InlineNumber({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="h-9 w-24 rounded-md border border-og-line px-2 text-sm"
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function SelectField({
  disabled,
  label,
  options,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
      {label}
      <select
        className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.length === 0 ? <option value="">No options</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  disabled,
  label,
  type,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  type: "date" | "number";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
      {label}
      <input
        className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
        disabled={disabled}
        step={type === "number" ? "0.001" : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
      {label}
      <input
        className="h-10 rounded-md border border-og-line bg-gray-50 px-3 text-sm font-medium text-og-dark"
        readOnly
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
      {label}
      <textarea
        className="min-h-20 rounded-md border border-og-line px-3 py-2 text-sm font-medium text-og-dark"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function eventFields(eventType: string) {
  switch (eventType) {
    case "WASTAGE":
      return { qtyLabel: "Qty wasted", showRemarks: true };
    case "ISSUE_TO_OPS":
      return { qtyLabel: "Qty issued", showRemarks: true };
    case "SALE_CONSUMPTION":
      return { qtyLabel: "Qty sold", showRemarks: true };
    case "STOCK_COUNT":
      return { qtyLabel: "Counted qty", showRemarks: true };
    default:
      return { qtyLabel: "Qty", showRemarks: true };
  }
}

function wastageReasons(bootstrap: SyncBootstrap | null) {
  return (
    bootstrap?.reasonCodes.filter(
      (reason) => reason.active !== false && String(reason.type) === "WASTAGE",
    ) ?? []
  );
}

function buildSyncKpis(
  localQueue: LocalSyncEvent[],
  status: SyncStatus | null,
  loading: boolean,
): Kpi[] {
  const localRejected = localQueue.filter(
    (event) => event.status === "REJECTED",
  ).length;

  return [
    {
      label: "Local Queue",
      value: formatInteger(localQueue.length),
      meta: "Events stored in this browser",
      icon: "Database",
      tone: localQueue.length > 0 ? "warning" : "success",
    },
    {
      label: "Server Pending",
      value: loading ? "..." : formatInteger(status?.pending ?? 0),
      meta: "Received or processing batches",
      icon: "CloudUpload",
      tone: (status?.pending ?? 0) > 0 ? "info" : "success",
    },
    {
      label: "Rejected",
      value: loading
        ? "..."
        : formatInteger((status?.rejected ?? 0) + localRejected),
      meta: "Needs correction and retry",
      icon: "CloudAlert",
      tone: (status?.rejected ?? 0) + localRejected > 0 ? "danger" : "success",
    },
  ];
}

async function clientFromSession() {
  const token = getSessionAccessToken();

  if (!token) {
    throw new Error("Sign in again to continue.");
  }

  return new ApiClient(token);
}

function defaultDeviceId(bootstrap: SyncBootstrap | null, locationId: string) {
  return (
    bootstrap?.devices.find((device) => device.locationId === locationId)
      ?.deviceCode ??
    bootstrap?.devices.find((device) => !device.locationId)?.deviceCode ??
    ""
  );
}

function eventLocationId(event: LocalSyncEvent) {
  return event.locationId;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function itemLabel(bootstrap: SyncBootstrap | null, itemId: string) {
  const item = bootstrap?.items.find((candidate) => candidate.id === itemId);

  return item ? `${item.sku} - ${item.name}` : itemId.slice(0, 8);
}

function locationLabel(bootstrap: SyncBootstrap | null, locationId: string) {
  const location = bootstrap?.locations.find(
    (candidate) => text(candidate.id) === locationId,
  );

  return location
    ? `${text(location.code)} - ${text(location.name)}`
    : locationId.slice(0, 8);
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
