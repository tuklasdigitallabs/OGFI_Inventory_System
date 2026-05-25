"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApiClient,
  getSessionAccessToken,
  type AuthenticatedUser,
  type MasterDataRecord,
  type StockOnHandRow,
  type Transfer,
} from "@/lib/api-client";
import { Icon } from "@/lib/icons";
import type { Kpi, Screen } from "@/lib/screens";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

type TransfersLivePageProps = {
  screen: Screen;
};

type TransferLineForm = {
  itemId: string;
  lineId: string;
  qty: string;
};

type TransferForm = {
  neededDate: string;
  lines: TransferLineForm[];
  remarks: string;
  sourceLocationId: string;
  targetLocationId: string;
};

type ActionForm = {
  lineQty: Record<string, string>;
  notes: string;
  resolution: "SOURCE_RETAINED" | "LOSS_AT_SOURCE" | "RECEIVE_BALANCE";
  transfer: Transfer | null;
  type: "dispatch" | "receive" | "resolve" | null;
};

type ResourceState = {
  items: MasterDataRecord[];
  locations: MasterDataRecord[];
};

const emptyResources: ResourceState = {
  items: [],
  locations: [],
};

const emptyTransferForm: TransferForm = {
  neededDate: "",
  lines: [],
  remarks: "",
  sourceLocationId: "",
  targetLocationId: "",
};

const emptyActionForm: ActionForm = {
  lineQty: {},
  notes: "",
  resolution: "SOURCE_RETAINED",
  transfer: null,
  type: null,
};

export function TransfersLivePage({ screen }: TransfersLivePageProps) {
  const [actionForm, setActionForm] = useState<ActionForm>(emptyActionForm);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TransferForm>(emptyTransferForm);
  const [lineDraft, setLineDraft] = useState<TransferLineForm>(() =>
    createLineForm(),
  );
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<ResourceState>(emptyResources);
  const [saving, setSaving] = useState(false);
  const [sourceStockRows, setSourceStockRows] = useState<StockOnHandRow[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const canCreate = hasPermission(user, "transfers:create");
  const canApprove = hasPermission(user, "transfers:approve");
  const canDispatch = hasPermission(user, "transfers:dispatch");
  const canReceive = hasPermission(user, "transfers:receive");

  const kpis = useMemo<Kpi[]>(
    () => [
      {
        label: "Approved",
        value: countStatus(transfers, "APPROVED"),
        meta: "Ready to dispatch",
        icon: "CheckCircle2",
        tone: "success",
      },
      {
        label: "In Transit",
        value: countStatus(transfers, "DISPATCHED"),
        meta: "Awaiting branch receive",
        icon: "Route",
        tone: "info",
      },
      {
        label: "Variance",
        value: countStatus(transfers, "VARIANCE_REVIEW"),
        meta: "Needs review",
        icon: "Scale",
        tone: "warning",
      },
    ],
    [transfers],
  );
  const filteredTransfers = useMemo(
    () => applyTransferFilters(transfers, statusFilter, overdueOnly),
    [overdueOnly, statusFilter, transfers],
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const status = normalizeTransferStatusFilter(
      searchParams.get("status") ?? "",
    );

    if (status) {
      setStatusFilter(status);
    }

    setOverdueOnly(searchParams.get("overdue") === "true");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTransfers() {
      const token = getSessionAccessToken();

      if (!token) {
        setError("Sign in again to load transfers.");
        setLoading(false);
        return;
      }

      try {
        const client = new ApiClient(token);
        const [currentUser, locations, items, transferResponse] =
          await Promise.all([
            client.currentUser(),
            client.masterData<MasterDataRecord>("locations"),
            client.masterData<MasterDataRecord>("items"),
            client.transfers(),
          ]);

        if (!cancelled) {
          setUser(currentUser);
          setResources({
            items: items.data.filter((item) => item.active !== false),
            locations: locations.data.filter(
              (location) => location.active !== false,
            ),
          });
          setTransfers(transferResponse.data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load transfers.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTransfers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSourceStock() {
      if (!form.sourceLocationId) {
        setSourceStockRows([]);
        return;
      }

      try {
        const client = await clientFromSession();
        const response = await client.stockOnHand(form.sourceLocationId);

        if (!cancelled) {
          setSourceStockRows(response.data);
        }
      } catch (stockError) {
        if (!cancelled) {
          setSourceStockRows([]);
          setError(
            stockError instanceof Error
              ? stockError.message
              : "Unable to load source stock.",
          );
        }
      }
    }

    void loadSourceStock();

    return () => {
      cancelled = true;
    };
  }, [form.sourceLocationId]);

  async function refresh(client: ApiClient) {
    const transferResponse = await client.transfers();
    setTransfers(transferResponse.data);
  }

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.sourceLocationId || !form.targetLocationId) {
      setError("Select source and target locations before creating transfer.");
      return;
    }

    if (form.sourceLocationId === form.targetLocationId) {
      setError("Source and target locations must be different.");
      return;
    }

    if (form.lines.length === 0) {
      setError("Add at least one transfer line.");
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();
      await client.createTransfer({
        sourceLocationId: form.sourceLocationId,
        targetLocationId: form.targetLocationId,
        neededDate: form.neededDate || undefined,
        remarks: form.remarks || undefined,
        lines: form.lines.map((line) => ({
          itemId: line.itemId,
          qty: Number(line.qty),
        })),
      });
      await refresh(client);
      setForm(emptyTransferForm);
      setLineDraft(createLineForm());
      setError(null);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create transfer.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function approveTransfer(transfer: Transfer) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      await client.approveTransfer(transfer.id);
      await refresh(client);
      setError(null);
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Unable to approve transfer.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitActionForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!actionForm.transfer || !actionForm.type) {
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();

      if (actionForm.type === "dispatch") {
        await client.dispatchTransfer(actionForm.transfer.id, {
          lines: actionForm.transfer.lines.map((line) => ({
            lineId: line.id,
            pickedQty: Number(actionForm.lineQty[line.id] || 0),
          })),
          remarks: actionForm.notes || undefined,
        });
      } else if (actionForm.type === "receive") {
        await client.receiveTransfer(actionForm.transfer.id, {
          lines: actionForm.transfer.lines.map((line) => ({
            lineId: line.id,
            receivedQty: Number(actionForm.lineQty[line.id] || 0),
          })),
          varianceNotes: actionForm.notes || undefined,
        });
      } else {
        await client.resolveTransferVariance(actionForm.transfer.id, {
          resolution: actionForm.resolution,
          notes: actionForm.notes || undefined,
        });
      }

      await refresh(client);
      setActionForm(emptyActionForm);
      setError(null);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update transfer.",
      );
    } finally {
      setSaving(false);
    }
  }

  function addLine() {
    if (!lineDraft.itemId || Number(lineDraft.qty) <= 0) {
      setError("Select an item and enter a quantity before adding the line.");
      return;
    }

    const sourceStock = sourceStockRows.find(
      (row) => row.itemId === lineDraft.itemId,
    );
    const availableQty = Number(
      sourceStock?.availableQty ?? sourceStock?.qtyOnHand ?? 0,
    );
    const requestedQty = Number(lineDraft.qty);

    if (!sourceStock || availableQty <= 0) {
      setError("Selected item has no available stock at the source location.");
      return;
    }

    if (requestedQty > availableQty) {
      setError("Transfer quantity exceeds available source stock.");
      return;
    }

    setForm({ ...form, lines: [...form.lines, lineDraft] });
    setLineDraft(createLineForm());
    setError(null);
  }

  function startAction(
    transfer: Transfer,
    type: "dispatch" | "receive" | "resolve",
  ) {
    setActionForm({
      lineQty: Object.fromEntries(
        transfer.lines.map((line) => [
          line.id,
          type === "dispatch"
            ? line.requestedQty
            : (line.pickedQty ?? line.requestedQty),
        ]),
      ),
      notes: "",
      resolution: "SOURCE_RETAINED",
      transfer,
      type,
    });
    setError(null);
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
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      {error ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-og-error">
          {error}
        </div>
      ) : null}

      <section className="og-card flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-col gap-1 text-xs font-semibold text-og-dark">
          Status
          <select
            className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setOverdueOnly(false);
            }}
          >
            <option value="">All</option>
            <option value="PENDING">Pending approval</option>
            <option value="APPROVED">Approved</option>
            <option value="DISPATCHED">In transit</option>
            <option value="VARIANCE_REVIEW">Variance review</option>
            <option value="RECEIVED">Received</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
        {overdueOnly ? (
          <button
            className="h-10 rounded-md border border-og-line px-3 text-sm font-semibold text-og-dark"
            type="button"
            onClick={() => setOverdueOnly(false)}
          >
            Clear overdue filter
          </button>
        ) : null}
      </section>

      {actionForm.transfer ? (
        <TransferActionForm
          actionForm={actionForm}
          disabled={saving}
          setActionForm={setActionForm}
          submit={submitActionForm}
        />
      ) : canCreate ? (
        <form className="og-card flex flex-col gap-4" onSubmit={createTransfer}>
          <div className="grid gap-4 md:grid-cols-5">
            <ReadOnlyField label="Transfer Ref" value="Auto-generated" />
            <SelectField
              label="Source"
              value={form.sourceLocationId}
              options={resources.locations}
              labelFor={(location) => text(location.code)}
              onChange={(sourceLocationId) =>
                setForm({ ...form, lines: [], sourceLocationId })
              }
            />
            <SelectField
              label="Target"
              value={form.targetLocationId}
              options={resources.locations}
              labelFor={(location) => text(location.code)}
              onChange={(targetLocationId) =>
                setForm({ ...form, targetLocationId })
              }
            />
            <InputField
              label="Needed"
              type="date"
              value={form.neededDate}
              onChange={(neededDate) => setForm({ ...form, neededDate })}
            />
            <InputField
              label="Remarks"
              type="text"
              value={form.remarks}
              onChange={(remarks) => setForm({ ...form, remarks })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px_150px_220px_auto]">
            <SelectField
              label="Item"
              value={lineDraft.itemId}
              options={resources.items}
              labelFor={(item) => text(item.sku)}
              onChange={(itemId) => setLineDraft({ ...lineDraft, itemId })}
            />
            <ReadOnlyField
              label="UOM"
              value={itemBaseUomCode(
                resources.items.find((item) => item.id === lineDraft.itemId),
              )}
            />
            <InputField
              label="Qty"
              min="0.000001"
              step="0.000001"
              type="number"
              value={lineDraft.qty}
              onChange={(qty) => setLineDraft({ ...lineDraft, qty })}
            />
            <SourceStockField
              itemId={lineDraft.itemId}
              stockRows={sourceStockRows}
              qty={lineDraft.qty}
            />
            <button
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-og-line px-4 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green"
              disabled={saving}
              type="button"
              onClick={addLine}
            >
              <Icon name="PlusCircle" size={16} />
              Add line
            </button>
          </div>
          <DraftTransferLines
            lines={form.lines}
            resources={resources}
            sourceStockRows={sourceStockRows}
            removeLine={(lineId) =>
              setForm({
                ...form,
                lines: form.lines.filter((line) => line.lineId !== lineId),
              })
            }
          />
          <button
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || loading}
            type="submit"
          >
            <Icon name="Save" size={16} />
            Create Transfer
          </button>
        </form>
      ) : null}

      <TransfersTable
        canApprove={canApprove}
        canDispatch={canDispatch}
        canReceive={canReceive}
        loading={loading}
        saving={saving}
        transfers={filteredTransfers}
        approve={approveTransfer}
        startAction={startAction}
      />
    </div>
  );
}

function applyTransferFilters(
  transfers: Transfer[],
  statusFilter: string,
  overdueOnly: boolean,
) {
  const statusFiltered = !statusFilter
    ? transfers
    : statusFilter === "PENDING"
      ? transfers.filter((transfer) =>
          ["DRAFT", "PENDING_APPROVAL"].includes(transfer.status),
        )
      : transfers.filter((transfer) => transfer.status === statusFilter);

  if (!overdueOnly) {
    return statusFiltered;
  }

  return statusFiltered.filter(
    (transfer) =>
      transfer.status === "DISPATCHED" &&
      isBeforeToday(transfer.updatedAt ?? transfer.createdAt),
  );
}

function normalizeTransferStatusFilter(value: string) {
  const normalized = value.trim().toUpperCase();

  if (normalized === "PENDING") {
    return "PENDING";
  }

  return [
    "APPROVED",
    "CLOSED",
    "DISPATCHED",
    "PENDING_APPROVAL",
    "RECEIVED",
    "VARIANCE_REVIEW",
  ].includes(normalized)
    ? normalized === "PENDING_APPROVAL"
      ? "PENDING"
      : normalized
    : "";
}

function isBeforeToday(value: string) {
  const date = new Date(value);
  const today = new Date();

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return date.getTime() < today.getTime();
}

function TransferActionForm({
  actionForm,
  disabled,
  setActionForm,
  submit,
}: {
  actionForm: ActionForm;
  disabled: boolean;
  setActionForm: (form: ActionForm) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const transfer = actionForm.transfer!;
  const label =
    actionForm.type === "dispatch"
      ? "Dispatch"
      : actionForm.type === "receive"
        ? "Receive"
        : "Resolve Variance";

  if (actionForm.type === "resolve") {
    return (
      <form className="og-card flex flex-col gap-4" onSubmit={submit}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-poppins text-xl font-semibold text-og-dark">
            Resolve {transfer.transferNumber}
          </h2>
          <button
            className="rounded-md border border-og-line px-3 py-2 text-sm font-semibold text-og-dark hover:bg-orange-50"
            type="button"
            onClick={() => setActionForm(emptyActionForm)}
          >
            Close
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-og-line">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr>
                {["Item", "UOM", "Picked", "Received", "Unresolved"].map(
                  (column) => (
                    <th
                      className="px-3 py-2 text-xs font-bold text-og-gray"
                      key={column}
                    >
                      {column}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((line) => (
                <tr className="border-t border-og-line" key={line.id}>
                  <td className="px-3 py-2 font-semibold text-og-dark">
                    {text(line.item?.sku)}
                  </td>
                  <td className="px-3 py-2 text-og-dark">
                    {itemBaseUomCode(line.item)}
                  </td>
                  <td className="px-3 py-2 text-og-dark">
                    {decimal(line.pickedQty)}
                  </td>
                  <td className="px-3 py-2 text-og-dark">
                    {decimal(line.receivedQty)}
                  </td>
                  <td className="px-3 py-2 text-og-dark">
                    {decimal(unresolvedQty(line))} {itemBaseUomCode(line.item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
          Resolution
          <select
            className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
            value={actionForm.resolution}
            onChange={(event) =>
              setActionForm({
                ...actionForm,
                resolution: event.target.value as ActionForm["resolution"],
              })
            }
          >
            <option value="SOURCE_RETAINED">
              Return/keep balance at source
            </option>
            <option value="LOSS_AT_SOURCE">Post balance as source loss</option>
            <option value="RECEIVE_BALANCE">
              Receive remaining balance at destination
            </option>
          </select>
        </label>
        <InputField
          label="Resolution Notes"
          type="text"
          value={actionForm.notes}
          onChange={(notes) => setActionForm({ ...actionForm, notes })}
        />
        <button
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          <Icon name="Scale" size={16} />
          Resolve Variance
        </button>
      </form>
    );
  }

  return (
    <form className="og-card flex flex-col gap-4" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-poppins text-xl font-semibold text-og-dark">
          {label} {transfer.transferNumber}
        </h2>
        <button
          className="rounded-md border border-og-line px-3 py-2 text-sm font-semibold text-og-dark hover:bg-orange-50"
          type="button"
          onClick={() => setActionForm(emptyActionForm)}
        >
          Close
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-og-line">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Item", "UOM", "Requested", "Picked", "Qty Now"].map(
                (column) => (
                  <th
                    className="px-3 py-2 text-xs font-bold text-og-gray"
                    key={column}
                  >
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((line) => (
              <tr className="border-t border-og-line" key={line.id}>
                <td className="px-3 py-2 font-semibold text-og-dark">
                  {text(line.item?.sku)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {itemBaseUomCode(line.item)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {decimal(line.requestedQty)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {decimal(line.pickedQty)}
                </td>
                <td className="px-3 py-2">
                  <input
                    className="h-10 w-full rounded-md border border-og-line px-3"
                    min="0"
                    step="0.000001"
                    type="number"
                    value={actionForm.lineQty[line.id] ?? ""}
                    onChange={(event) =>
                      setActionForm({
                        ...actionForm,
                        lineQty: {
                          ...actionForm.lineQty,
                          [line.id]: event.target.value,
                        },
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {actionForm.type === "receive" ? (
        <InputField
          label="Variance Notes"
          type="text"
          value={actionForm.notes}
          onChange={(notes) => setActionForm({ ...actionForm, notes })}
        />
      ) : null}
      <button
        className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        <Icon
          name={actionForm.type === "dispatch" ? "Truck" : "PackageCheck"}
          size={16}
        />
        Post {label}
      </button>
    </form>
  );
}

function DraftTransferLines({
  lines,
  removeLine,
  resources,
  sourceStockRows,
}: {
  lines: TransferLineForm[];
  removeLine: (lineId: string) => void;
  resources: ResourceState;
  sourceStockRows: StockOnHandRow[];
}) {
  if (lines.length === 0) {
    return (
      <div className="rounded-md border border-og-line px-4 py-8 text-center text-sm font-semibold text-og-gray">
        No transfer lines added.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-og-line">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {["Item", "UOM", "Qty", "Source Available", "Remaining", ""].map(
              (column) => (
                <th
                  className="px-3 py-2 text-xs font-bold text-og-gray"
                  key={column}
                >
                  {column}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const item = resources.items.find(
              (record) => record.id === line.itemId,
            );
            const stock = sourceStockRows.find(
              (row) => row.itemId === line.itemId,
            );
            const sourceAvailable = Number(
              stock?.availableQty ?? stock?.qtyOnHand ?? 0,
            );
            const remaining = sourceAvailable - Number(line.qty);

            return (
              <tr className="border-t border-og-line" key={line.lineId}>
                <td className="px-3 py-2 font-semibold text-og-dark">
                  {text(item?.sku)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {itemBaseUomCode(item)}
                </td>
                <td className="px-3 py-2 text-og-dark">{decimal(line.qty)}</td>
                <td className="px-3 py-2 text-og-dark">
                  {stock
                    ? `${decimal(sourceAvailable)} ${stock.baseUomCode}`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  <span
                    className={
                      stock?.lowStockThreshold !== null &&
                      stock?.lowStockThreshold !== undefined &&
                      remaining <= Number(stock.lowStockThreshold)
                        ? "font-semibold text-og-warning"
                        : ""
                    }
                  >
                    {stock ? `${decimal(remaining)} ${stock.baseUomCode}` : "-"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="rounded-md p-1 text-og-gray hover:bg-orange-50 hover:text-og-error"
                    type="button"
                    onClick={() => removeLine(line.lineId)}
                  >
                    <Icon name="X" size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TransfersTable({
  approve,
  canApprove,
  canDispatch,
  canReceive,
  loading,
  saving,
  startAction,
  transfers,
}: {
  approve: (transfer: Transfer) => void;
  canApprove: boolean;
  canDispatch: boolean;
  canReceive: boolean;
  loading: boolean;
  saving: boolean;
  startAction: (
    transfer: Transfer,
    type: "dispatch" | "receive" | "resolve",
  ) => void;
  transfers: Transfer[];
}) {
  const [expandedTransferId, setExpandedTransferId] = useState<string | null>(
    null,
  );

  return (
    <section className="og-card overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-og-line p-4">
        <Icon name="ArrowRightLeft" size={20} className="text-og-green" />
        <h2 className="font-poppins text-xl font-semibold text-og-dark">
          Transfers
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["Transfer", "From", "To", "Needed", "Lines", "Status"].map(
                (column) => (
                  <th className="og-table-header" key={column}>
                    {column}
                  </th>
                ),
              )}
              <th className="og-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <StateRow label="Loading transfers" /> : null}
            {!loading && transfers.length === 0 ? (
              <StateRow label="No transfers found" />
            ) : null}
            {!loading
              ? transfers.map((transfer) => {
                  const expanded = expandedTransferId === transfer.id;

                  return (
                    <Fragment key={transfer.id}>
                      <tr className="border-t border-og-line hover:bg-[#fff5e4]">
                        <td className="og-table-cell font-semibold">
                          {transfer.transferNumber}
                          {transfer.requiresLowStockApproval ? (
                            <div className="mt-1 text-xs font-semibold text-og-warning">
                              Low stock approval
                            </div>
                          ) : null}
                        </td>
                        <td className="og-table-cell">
                          {text(transfer.sourceLocation?.code)}
                        </td>
                        <td className="og-table-cell">
                          {text(transfer.targetLocation?.code)}
                        </td>
                        <td className="og-table-cell">
                          {formatDate(transfer.neededDate)}
                        </td>
                        <td className="og-table-cell">
                          <button
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-og-line px-2 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green"
                            type="button"
                            onClick={() =>
                              setExpandedTransferId(
                                expanded ? null : transfer.id,
                              )
                            }
                          >
                            <Icon
                              name={expanded ? "ChevronUp" : "ChevronDown"}
                              size={14}
                            />
                            {transfer.lineCount ?? transfer.lines.length}
                          </button>
                        </td>
                        <td className="og-table-cell">
                          <StatusBadge value={transfer.status} />
                        </td>
                        <td className="og-table-cell">
                          <div className="flex justify-end gap-1">
                            {transfer.status === "DRAFT" && canApprove ? (
                              <IconButton
                                disabled={saving}
                                icon="Check"
                                label="Approve"
                                onClick={() => approve(transfer)}
                              />
                            ) : null}
                            {transfer.status === "APPROVED" && canDispatch ? (
                              <IconButton
                                disabled={saving}
                                icon="Truck"
                                label="Dispatch"
                                onClick={() =>
                                  startAction(transfer, "dispatch")
                                }
                              />
                            ) : null}
                            {transfer.status === "DISPATCHED" && canReceive ? (
                              <IconButton
                                disabled={saving}
                                icon="PackageCheck"
                                label="Receive"
                                onClick={() => startAction(transfer, "receive")}
                              />
                            ) : null}
                            {transfer.status === "VARIANCE_REVIEW" &&
                            canApprove ? (
                              <IconButton
                                disabled={saving}
                                icon="Scale"
                                label="Review variance"
                                onClick={() => startAction(transfer, "resolve")}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-og-line bg-gray-50">
                          <td className="px-4 py-3" colSpan={7}>
                            <TransferLineSnapshot transfer={transfer} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectField({
  label,
  labelFor,
  onChange,
  options,
  value,
}: {
  label: string;
  labelFor: (record: MasterDataRecord) => string;
  onChange: (value: string) => void;
  options: MasterDataRecord[];
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
      {label}
      <select
        className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TransferLineSnapshot({ transfer }: { transfer: Transfer }) {
  return (
    <div className="overflow-x-auto rounded-md border border-og-line bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead>
          <tr>
            {[
              "Item",
              "Requested",
              "Picked",
              "Received",
              "Unresolved",
              "Available at Request",
              "Remaining",
              "Threshold",
              "Warning",
            ].map((column) => (
              <th className="px-3 py-2 font-bold text-og-gray" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transfer.lines.map((line) => (
            <tr className="border-t border-og-line" key={line.id}>
              <td className="px-3 py-2 font-semibold text-og-dark">
                {text(line.item?.sku)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.requestedQty)} {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.pickedQty)} {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.receivedQty)} {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(unresolvedQty(line))} {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.sourceQtyAvailableAtRequest)}{" "}
                {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.sourceQtyRemainingAfterRequest)}{" "}
                {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.sourceLowStockThreshold)}{" "}
                {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {line.sourceLowStockAfterRequest ? (
                  <span className="font-semibold text-og-warning">
                    Low after transfer
                  </span>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transfer.lowStockApprovalReason ? (
        <div className="border-t border-og-line px-3 py-2 text-xs font-semibold text-og-warning">
          {transfer.lowStockApprovalReason}
        </div>
      ) : null}
    </div>
  );
}

function InputField({
  label,
  min,
  onChange,
  step,
  type,
  value,
}: {
  label: string;
  min?: string;
  onChange: (value: string) => void;
  step?: string;
  type: "date" | "number" | "text";
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
      {label}
      <input
        className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
        min={min}
        step={step}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
      {label}
      <div className="flex h-10 items-center rounded-md border border-og-line bg-gray-50 px-3 text-sm font-normal text-og-gray">
        {value || "-"}
      </div>
    </div>
  );
}

function SourceStockField({
  itemId,
  qty,
  stockRows,
}: {
  itemId: string;
  qty: string;
  stockRows: StockOnHandRow[];
}) {
  const stock = stockRows.find((row) => row.itemId === itemId);

  if (!itemId) {
    return <ReadOnlyField label="Source Stock" value="Select item" />;
  }

  if (!stock) {
    return <ReadOnlyField label="Source Stock" value="No stock" />;
  }

  const availableQty = Number(stock.availableQty ?? stock.qtyOnHand);
  const remainingAvailable = availableQty - Number(qty || 0);
  const lowAfter =
    stock.lowStockThreshold !== null &&
    remainingAvailable <= Number(stock.lowStockThreshold);
  const value = `${decimal(availableQty)} ${stock.baseUomCode} available / ${decimal(remainingAvailable)} after`;

  return (
    <div className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
      Source Stock
      <div
        className={`flex h-10 items-center rounded-md border px-3 text-sm font-normal ${
          lowAfter
            ? "border-orange-200 bg-orange-50 text-og-warning"
            : "border-og-line bg-gray-50 text-og-gray"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function IconButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: "Check" | "PackageCheck" | "Scale" | "Truck";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="rounded-md p-2 text-og-gray hover:bg-white hover:text-og-green disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

function StateRow({ label }: { label: string }) {
  return (
    <tr className="border-t border-og-line">
      <td className="og-table-cell py-8 text-center text-og-gray" colSpan={7}>
        {label}
      </td>
    </tr>
  );
}

function createLineForm(): TransferLineForm {
  return {
    itemId: "",
    lineId: `transfer-line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    qty: "1",
  };
}

async function clientFromSession() {
  const token = getSessionAccessToken();

  if (!token) {
    throw new Error("Sign in again to continue.");
  }

  return new ApiClient(token);
}

function countStatus(transfers: Transfer[], status: string) {
  return String(
    transfers.filter((transfer) => transfer.status === status).length,
  );
}

function unresolvedQty(line: Transfer["lines"][number]) {
  return Number(line.pickedQty ?? 0) - Number(line.receivedQty ?? 0);
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return Number(value).toLocaleString("en-PH", { maximumFractionDigits: 6 });
}

function itemBaseUomCode(item: MasterDataRecord | undefined) {
  if (!item) {
    return "-";
  }

  if (isRecord(item.baseUom) && typeof item.baseUom.code === "string") {
    return item.baseUom.code;
  }

  if (typeof item.baseUomCode === "string") {
    return item.baseUomCode;
  }

  return "-";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function hasPermission(user: AuthenticatedUser | null, permission: string) {
  return user?.permissions.includes(permission) ?? false;
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}
