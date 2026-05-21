"use client";

import {
  Fragment,
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import {
  ApiClient,
  TOKEN_KEY,
  type AuthenticatedUser,
  type BranchOperationRecord,
  type MasterDataRecord,
  type StockOnHandRow,
  type SyncBootstrap,
  type Transfer,
} from "@/lib/api-client";
import { Icon, type IconName } from "@/lib/icons";
import {
  getCachedValue,
  getOfflineQueue,
  saveOfflineQueue,
} from "@/lib/offline-db";
import type { LocalSyncEvent } from "@/lib/offline-types";
import type { Kpi, Screen } from "@/lib/screens";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

type StoreOperationsExpandedPageProps = {
  screen: Screen;
};

type SimpleForm = {
  itemId: string;
  uomId: string;
  qty: string;
  countType: StockCountTypeOption;
  reasonCodeId: string;
  remarks: string;
  looseRemainderQty: string;
  looseWholeUnits: string;
};

type StoreTab = "stock" | "transfers" | "wastage" | "count" | "issue" | "sales";
type StockCountTypeOption = "OPENING" | "EOD";

type ReceiveForm = {
  lineQty: Record<string, string>;
  notes: string;
  transfer: Transfer | null;
};

const blankSimpleForm: SimpleForm = {
  itemId: "",
  uomId: "",
  qty: "",
  countType: "EOD",
  reasonCodeId: "",
  remarks: "",
  looseRemainderQty: "",
  looseWholeUnits: "",
};

const emptyReceiveForm: ReceiveForm = {
  lineQty: {},
  notes: "",
  transfer: null,
};

const storeTabs: Array<{ id: StoreTab; label: string; icon: IconName }> = [
  { id: "stock", label: "Stock On Hand", icon: "Package" },
  { id: "transfers", label: "Incoming Transfers", icon: "Inbox" },
  { id: "wastage", label: "Wastage", icon: "ClipboardList" },
  { id: "count", label: "Stock Count", icon: "ClipboardCheck" },
  { id: "issue", label: "Issue to Ops", icon: "Utensils" },
  { id: "sales", label: "Sales Batch", icon: "ReceiptText" },
];

const stockCountTypes: Array<{ value: StockCountTypeOption; label: string }> = [
  { value: "OPENING", label: "Beginning Count" },
  { value: "EOD", label: "EOD Count" },
];

export function StoreOperationsExpandedPage({
  screen,
}: StoreOperationsExpandedPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<MasterDataRecord[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [items, setItems] = useState<MasterDataRecord[]>([]);
  const [uoms, setUoms] = useState<MasterDataRecord[]>([]);
  const [uomConversions, setUomConversions] = useState<MasterDataRecord[]>([]);
  const [reasonCodes, setReasonCodes] = useState<MasterDataRecord[]>([]);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>(emptyReceiveForm);
  const [saving, setSaving] = useState(false);
  const [stockRows, setStockRows] = useState<StockOnHandRow[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [unresolvedTransfers, setUnresolvedTransfers] = useState<Transfer[]>(
    [],
  );
  const [wastageRows, setWastageRows] = useState<BranchOperationRecord[]>([]);
  const [stockCountRows, setStockCountRows] = useState<BranchOperationRecord[]>(
    [],
  );
  const [issueRows, setIssueRows] = useState<BranchOperationRecord[]>([]);
  const [salesRows, setSalesRows] = useState<BranchOperationRecord[]>([]);
  const [activeTab, setActiveTab] = useState<StoreTab>("stock");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [wastageForm, setWastageForm] = useState<SimpleForm>(blankSimpleForm);
  const [countForm, setCountForm] = useState<SimpleForm>(blankSimpleForm);
  const [issueForm, setIssueForm] = useState<SimpleForm>(blankSimpleForm);
  const [notice, setNotice] = useState<string | null>(null);
  const [salesForm, setSalesForm] = useState<SimpleForm>(blankSimpleForm);

  useEffect(() => {
    let cancelled = false;

    async function loadBaseData() {
      const token = window.localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setError("Sign in again to load store operations.");
        setLoading(false);
        return;
      }

      try {
        const client = new ApiClient(token);
        const [
          currentUser,
          locationResponse,
          itemResponse,
          uomResponse,
          conversionResponse,
          reasonResponse,
        ] = await Promise.all([
          client.currentUser(),
          client.masterData<MasterDataRecord>("locations"),
          client.masterData<MasterDataRecord>("items"),
          client.masterData<MasterDataRecord>("uoms"),
          client.masterData<MasterDataRecord>("uom-conversions"),
          client.masterData<MasterDataRecord>("reason-codes"),
        ]);

        if (cancelled) {
          return;
        }

        const accessibleLocations = locationResponse.data.filter(
          (location) =>
            location.active !== false &&
            currentUser.locationIds.includes(location.id),
        );

        setUser(currentUser);
        setLocations(accessibleLocations);
        setSelectedLocationId(accessibleLocations[0]?.id ?? "");
        setItems(itemResponse.data.filter((item) => item.active !== false));
        setUoms(uomResponse.data.filter((uom) => uom.active !== false));
        setUomConversions(conversionResponse.data);
        setReasonCodes(
          reasonResponse.data.filter(
            (reason) =>
              reason.active !== false && String(reason.type) === "WASTAGE",
          ),
        );
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            toErrorMessage(loadError, "Unable to load store operations."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBaseData();

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo<Kpi[]>(
    () => [
      {
        label: "Stock Items",
        value: loading ? "..." : String(stockRows.length),
        meta: "Current branch stock rows",
        icon: "Package",
        tone: "info",
      },
      {
        label: "Incoming Transfers",
        value: String(transfers.length),
        meta: "Ready for branch receive",
        icon: "Inbox",
        tone: transfers.length > 0 ? "warning" : "success",
      },
      {
        label: "Low Stock",
        value: String(
          stockRows.filter((row) => inventoryStatus(row) === "Low").length,
        ),
        meta: "At or below threshold",
        icon: "AlertTriangle",
        tone: stockRows.some((row) => inventoryStatus(row) === "Low")
          ? "warning"
          : "success",
      },
    ],
    [loading, stockRows, transfers.length],
  );

  const availableItems = useMemo(() => {
    const availableItemIds = new Set(
      stockRows
        .filter((row) => Number(row.availableQty ?? row.qtyOnHand) > 0)
        .map((row) => row.itemId),
    );

    return items.filter((item) => availableItemIds.has(item.id));
  }, [items, stockRows]);

  const salesItems = useMemo(
    () => items.filter((item) => String(item.itemType) === "FINISHED_GOOD"),
    [items],
  );

  const refreshLocationData = useCallback(
    async (locationId: string, currentUser = user) => {
      if (!currentUser) {
        return;
      }

      const client = await clientFromSession();
      const [stockResponse, transferResponse] = await Promise.all([
        client.stockOnHand(locationId),
        client.transfers(),
      ]);

      setStockRows(stockResponse.data);
      setTransfers(
        transferResponse.data.filter(
          (transfer) =>
            transfer.status === "DISPATCHED" &&
            transfer.targetLocationId === locationId &&
            currentUser.locationIds.includes(transfer.targetLocationId),
        ),
      );
      setUnresolvedTransfers(
        transferResponse.data.filter(
          (transfer) =>
            ["DISPATCHED", "VARIANCE_REVIEW"].includes(transfer.status) &&
            (transfer.sourceLocationId === locationId ||
              transfer.targetLocationId === locationId),
        ),
      );
      setError(null);

      if (currentUser.permissions.includes("branch.wastage:read")) {
        const response = await client.branchWastage(locationId);
        setWastageRows(response.data);
      } else {
        setWastageRows([]);
      }

      if (currentUser.permissions.includes("branch.stock-counts:read")) {
        const response = await client.branchStockCounts(locationId);
        setStockCountRows(response.data);
      } else {
        setStockCountRows([]);
      }

      if (currentUser.permissions.includes("branch.issues:read")) {
        const response = await client.branchIssues(locationId);
        setIssueRows(response.data);
      } else {
        setIssueRows([]);
      }

      if (currentUser.permissions.includes("branch.sales-batches:read")) {
        const response = await client.branchSalesBatches(locationId);
        setSalesRows(response.data);
      } else {
        setSalesRows([]);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!selectedLocationId || !user) {
      return;
    }

    void refreshLocationData(selectedLocationId, user);
  }, [refreshLocationData, selectedLocationId, user]);

  async function submitReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!receiveForm.transfer || !selectedLocationId) {
      return;
    }

    await submitAction(async (client) => {
      await client.receiveTransfer(receiveForm.transfer!.id, {
        lines: receiveForm.transfer!.lines.map((line) => ({
          lineId: line.id,
          receivedQty: Number(receiveForm.lineQty[line.id] || 0),
        })),
        varianceNotes: receiveForm.notes || undefined,
      });
      setReceiveForm(emptyReceiveForm);
    });
  }

  async function submitWastage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.navigator.onLine) {
      await queueStoreOperationOffline("WASTAGE", wastageForm);
      setWastageForm(blankSimpleForm);
      return;
    }

    await submitAction(async (client) => {
      validateUomSelection(wastageForm, items, uomConversions);
      await client.createBranchWastage({
        locationId: selectedLocationId,
        reasonCodeId: wastageForm.reasonCodeId,
        businessDate: today(),
        remarks: wastageForm.remarks || undefined,
        lines: [
          {
            itemId: wastageForm.itemId,
            uomId: wastageForm.uomId,
            qty: Number(wastageForm.qty),
          },
        ],
      });
      setWastageForm(blankSimpleForm);
    });
  }

  async function submitStockCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.navigator.onLine) {
      const pendingQueue = await getOfflineQueue();
      setError(
        pendingQueue.length > 0
          ? "Reconnect and sync pending offline events before posting a stock count or EOD count."
          : "Stock counts and EOD close require a live connection because they compare against current server balances.",
      );
      return;
    }

    await submitAction(async (client) => {
      validateUomSelection(countForm, items, uomConversions);
      await client.submitBranchStockCount({
        locationId: selectedLocationId,
        countType: countForm.countType,
        businessDate: today(),
        lines: [
          {
            itemId: countForm.itemId,
            uomId: countForm.uomId,
            countedQty: Number(countForm.qty),
            looseRemainderQty: numberOrUndefined(countForm.looseRemainderQty),
            looseWholeUnits: numberOrUndefined(countForm.looseWholeUnits),
          },
        ],
      });
      setCountForm(blankSimpleForm);
    });
  }

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.navigator.onLine) {
      await queueStoreOperationOffline("ISSUE_TO_OPS", issueForm);
      setIssueForm(blankSimpleForm);
      return;
    }

    await submitAction(async (client) => {
      validateUomSelection(issueForm, items, uomConversions);
      await client.createBranchIssue({
        locationId: selectedLocationId,
        businessDate: today(),
        remarks: issueForm.remarks || undefined,
        lines: [
          {
            itemId: issueForm.itemId,
            uomId: issueForm.uomId,
            qty: Number(issueForm.qty),
          },
        ],
      });
      setIssueForm(blankSimpleForm);
    });
  }

  async function submitSalesBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.navigator.onLine) {
      await queueStoreOperationOffline("SALE_CONSUMPTION", salesForm);
      setSalesForm(blankSimpleForm);
      return;
    }

    await submitAction(async (client) => {
      validateUomSelection(salesForm, items, uomConversions);
      await client.createBranchSalesBatch({
        locationId: selectedLocationId,
        businessDate: today(),
        lines: [
          {
            itemId: salesForm.itemId,
            uomId: salesForm.uomId,
            qtySold: Number(salesForm.qty),
          },
        ],
      });
      setSalesForm(blankSimpleForm);
    });
  }

  async function submitAction(action: (client: ApiClient) => Promise<void>) {
    if (!selectedLocationId) {
      setError("Select a branch/store location first.");
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();
      await action(client);
      await refreshLocationData(selectedLocationId);
      setError(null);
      setNotice(null);
    } catch (actionError) {
      setNotice(null);
      setError(toErrorMessage(actionError, "Unable to save store operation."));
    } finally {
      setSaving(false);
    }
  }

  async function queueStoreOperationOffline(
    eventType: LocalSyncEvent["eventType"],
    form: SimpleForm,
  ) {
    if (!selectedLocationId) {
      setError("Select a branch/store location first.");
      return;
    }

    validateUomSelection(form, items, uomConversions);

    const deviceId = await offlineDeviceForLocation(selectedLocationId);

    if (!deviceId) {
      setError(
        "No registered offline device is cached for this location. Reconnect and refresh offline data.",
      );
      return;
    }

    const queue = await getOfflineQueue();
    const itemStock = stockRows.find((row) => row.itemId === form.itemId);
    const qtyOut = toBaseQty(form, items, uomConversions);
    const nextEvent: LocalSyncEvent = {
      uuid: crypto.randomUUID(),
      businessDate: today(),
      deviceId,
      eventType,
      itemId: form.itemId,
      locationId: selectedLocationId,
      qtyIn: "",
      qtyOut: String(qtyOut),
      reasonCodeId: form.reasonCodeId || undefined,
      rejectionReason: null,
      remarks: form.remarks || undefined,
      status: "QUEUED",
      unitCostAtTime: itemStock?.averageUnitCost ?? "0",
    };

    await saveOfflineQueue([...queue, nextEvent]);
    setError(null);
    setNotice(
      "Connection is offline. Event saved to the offline queue and will be validated when synced.",
    );
  }

  function startReceive(transfer: Transfer) {
    setReceiveForm({
      lineQty: Object.fromEntries(
        transfer.lines.map((line) => [line.id, line.pickedQty ?? "0"]),
      ),
      notes: "",
      transfer,
    });
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
        <div className="min-w-[260px]">
          <SearchableLocationField
            label="Branch / Store"
            value={selectedLocationId}
            options={locations}
            onChange={setSelectedLocationId}
          />
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

      {notice ? (
        <div className="rounded-md border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-og-green">
          {notice}
        </div>
      ) : null}

      {unresolvedTransfers.length > 0 ? (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-og-warning">
          {unresolvedTransfers.length} unresolved transfer
          {unresolvedTransfers.length === 1 ? "" : "s"} must be received or
          variance-resolved before EOD close.
        </div>
      ) : null}

      {receiveForm.transfer ? (
        <BranchReceiveForm
          disabled={saving}
          form={receiveForm}
          setForm={setReceiveForm}
          submit={submitReceive}
        />
      ) : null}

      <section className="og-card flex flex-col gap-4 p-0">
        <div className="flex gap-2 overflow-x-auto border-b border-og-line p-3">
          {storeTabs.map((tab) => (
            <button
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                activeTab === tab.id
                  ? "border-og-green bg-green-50 text-og-green"
                  : "border-og-line text-og-dark hover:bg-orange-50"
              }`}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {activeTab === "stock" ? <StockTable rows={stockRows} /> : null}
          {activeTab === "transfers" ? (
            <IncomingTransfers
              disabled={saving}
              loading={loading}
              transfers={transfers}
              startReceive={startReceive}
            />
          ) : null}
          {activeTab === "wastage" ? (
            <OperationForm
              disabled={saving}
              form={wastageForm}
              items={availableItems}
              reasonCodes={reasonCodes}
              records={wastageRows}
              numberKey="wastageNumber"
              qtyLabel="Qty wasted"
              setForm={setWastageForm}
              showAvailable
              showReason
              stockRows={stockRows}
              submit={submitWastage}
              title="Wastage"
              uoms={uoms}
            />
          ) : null}
          {activeTab === "count" ? (
            <OperationForm
              disabled={saving}
              form={countForm}
              items={items}
              records={stockCountRows}
              numberKey="countNumber"
              qtyLabel="Counted qty"
              setForm={setCountForm}
              showCountType
              submit={submitStockCount}
              title="Stock Count"
              uoms={uoms}
            />
          ) : null}
          {activeTab === "issue" ? (
            <OperationForm
              disabled={saving}
              form={issueForm}
              items={availableItems}
              records={issueRows}
              numberKey="issueNumber"
              qtyLabel="Qty issued"
              setForm={setIssueForm}
              showAvailable
              stockRows={stockRows}
              submit={submitIssue}
              title="Issue to Ops"
              uoms={uoms}
            />
          ) : null}
          {activeTab === "sales" ? (
            <OperationForm
              disabled={saving}
              form={salesForm}
              items={salesItems}
              records={salesRows}
              numberKey="batchNumber"
              qtyLabel="Qty sold"
              setForm={setSalesForm}
              submit={submitSalesBatch}
              title="Sales Batch"
              uoms={uoms}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StockTable({ rows }: { rows: StockOnHandRow[] }) {
  return (
    <section className="og-card overflow-hidden p-0">
      <PanelTitle icon="Package" title="Branch Stock On Hand" />
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr>
              {[
                "SKU",
                "Item",
                "On Hand",
                "Available",
                "In Transit Out",
                "In Transit In",
                "Avg Cost",
                "Value",
                "Status",
              ].map((column) => (
                <th className="og-table-header" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <StateRow colSpan={9} label="No stock rows for this location" />
            ) : null}
            {rows.map((row) => (
              <tr
                className="border-t border-og-line"
                key={`${row.locationId}-${row.itemId}`}
              >
                <td className="og-table-cell font-semibold">{row.sku}</td>
                <td className="og-table-cell">{row.itemName}</td>
                <td className="og-table-cell">
                  {row.displayQty ??
                    `${decimal(row.qtyOnHand)} ${row.baseUomCode}`}
                </td>
                <td className="og-table-cell">
                  {row.displayAvailableQty ??
                    `${decimal(row.availableQty ?? row.qtyOnHand)} ${row.baseUomCode}`}
                </td>
                <td className="og-table-cell">
                  {decimal(row.reservedOutQty ?? "0")} {row.baseUomCode}
                </td>
                <td className="og-table-cell">
                  {decimal(row.inTransitInQty ?? "0")} {row.baseUomCode}
                </td>
                <td className="og-table-cell">
                  ₱{decimal(row.averageUnitCost)}
                </td>
                <td className="og-table-cell">
                  ₱{decimal(row.inventoryValue)}
                </td>
                <td className="og-table-cell">
                  <StatusBadge value={inventoryStatus(row)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IncomingTransfers({
  disabled,
  loading,
  transfers,
  startReceive,
}: {
  disabled: boolean;
  loading: boolean;
  transfers: Transfer[];
  startReceive: (transfer: Transfer) => void;
}) {
  return (
    <section className="og-card overflow-hidden p-0">
      <PanelTitle icon="Inbox" title="Incoming Transfers" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["Transfer", "From", "Lines", "Status"].map((column) => (
                <th className="og-table-header" key={column}>
                  {column}
                </th>
              ))}
              <th className="og-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <StateRow colSpan={5} label="Loading incoming transfers" />
            ) : null}
            {!loading && transfers.length === 0 ? (
              <StateRow
                colSpan={5}
                label="No incoming transfers ready to receive"
              />
            ) : null}
            {!loading
              ? transfers.map((transfer) => (
                  <tr className="border-t border-og-line" key={transfer.id}>
                    <td className="og-table-cell font-semibold">
                      {transfer.transferNumber}
                    </td>
                    <td className="og-table-cell">
                      {recordLabel(transfer.sourceLocation, "code")}
                    </td>
                    <td className="og-table-cell">
                      {transfer.lineCount ?? transfer.lines.length}
                    </td>
                    <td className="og-table-cell">
                      <StatusBadge value={transfer.status} />
                    </td>
                    <td className="og-table-cell text-right">
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-orange-50 hover:text-og-green disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={disabled}
                        title="Receive"
                        type="button"
                        onClick={() => startReceive(transfer)}
                      >
                        <Icon name="PackageCheck" size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BranchReceiveForm({
  disabled,
  form,
  setForm,
  submit,
}: {
  disabled: boolean;
  form: ReceiveForm;
  setForm: (form: ReceiveForm) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const transfer = form.transfer!;

  return (
    <form className="og-card flex flex-col gap-4" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-og-gray">
            Transfer Receiving
          </p>
          <h2 className="font-poppins text-xl font-semibold text-og-dark">
            {transfer.transferNumber}
          </h2>
        </div>
        <button
          className="rounded-md border border-og-line px-3 py-2 text-sm font-semibold text-og-dark hover:bg-orange-50"
          type="button"
          onClick={() => setForm(emptyReceiveForm)}
        >
          Close
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-og-line">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Item", "UOM", "Picked", "Received Now"].map((column) => (
                <th
                  className="px-3 py-2 text-xs font-bold text-og-gray"
                  key={column}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((line) => (
              <tr className="border-t border-og-line" key={line.id}>
                <td className="px-3 py-2 font-semibold text-og-dark">
                  {recordLabel(line.item, "sku")}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {itemBaseUomCode(line.item)}
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
                    value={form.lineQty[line.id] ?? ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        lineQty: {
                          ...form.lineQty,
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
      <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
        Variance Notes
        <input
          className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
          type="text"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </label>
      <button
        className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        <Icon name="PackageCheck" size={16} />
        Post Receiving
      </button>
    </form>
  );
}

function OperationForm({
  disabled,
  form,
  items,
  numberKey,
  qtyLabel,
  reasonCodes = [],
  records,
  setForm,
  showAvailable = false,
  showCountType = false,
  showReason = false,
  stockRows = [],
  submit,
  title,
  uoms,
}: {
  disabled: boolean;
  form: SimpleForm;
  items: MasterDataRecord[];
  numberKey: keyof BranchOperationRecord;
  qtyLabel: string;
  reasonCodes?: MasterDataRecord[];
  records: BranchOperationRecord[];
  setForm: (form: SimpleForm) => void;
  showAvailable?: boolean;
  showCountType?: boolean;
  showReason?: boolean;
  stockRows?: StockOnHandRow[];
  submit: (event: FormEvent<HTMLFormElement>) => void;
  title: string;
  uoms: MasterDataRecord[];
}) {
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === form.itemId);
  const selectedStock = stockRows.find((row) => row.itemId === form.itemId);
  const looseCountItem =
    showCountType && selectedItem?.looseCountEnabled === true;

  return (
    <section className="flex flex-col gap-4">
      <PanelTitle icon="ClipboardList" title={title} compact />
      <form
        className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_150px_160px]"
        onSubmit={submit}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
          Item
          <select
            className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
            required
            value={form.itemId}
            onChange={(event) => {
              const item = items.find(
                (record) => record.id === event.target.value,
              );
              setForm({
                ...form,
                itemId: event.target.value,
                looseRemainderQty: "",
                looseWholeUnits: "",
                uomId: itemBaseUomId(item),
              });
            }}
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {recordLabel(item, "sku")}
              </option>
            ))}
          </select>
          {showAvailable ? (
            <span className="text-[11px] font-normal text-og-gray">
              Available:{" "}
              {selectedStock
                ? (selectedStock.displayAvailableQty ??
                  `${decimal(selectedStock.availableQty ?? selectedStock.qtyOnHand)} ${selectedStock.baseUomCode}`)
                : "Select an available item"}
            </span>
          ) : null}
        </label>
        {looseCountItem ? (
          <>
            <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
              Full units ({relatedCode(selectedItem.looseWholeUom)})
              <input
                className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
                min="0"
                required
                step="1"
                type="number"
                value={form.looseWholeUnits}
                onChange={(event) =>
                  setForm({
                    ...form,
                    looseWholeUnits: event.target.value,
                    qty: computedLooseCountBaseQty(selectedItem, {
                      ...form,
                      looseWholeUnits: event.target.value,
                    }),
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
              Loose count ({relatedCode(selectedItem.looseRemainderUom)})
              <input
                className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
                min="0"
                required
                step="0.000001"
                type="number"
                value={form.looseRemainderQty}
                onChange={(event) =>
                  setForm({
                    ...form,
                    looseRemainderQty: event.target.value,
                    qty: computedLooseCountBaseQty(selectedItem, {
                      ...form,
                      looseRemainderQty: event.target.value,
                    }),
                  })
                }
              />
              <span className="text-[11px] font-normal text-og-gray">
                Total: {computedLooseCountBaseQty(selectedItem, form) || "0"}{" "}
                {itemBaseUomCode(selectedItem)}
              </span>
            </label>
          </>
        ) : (
          <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
            {qtyLabel}
            <input
              className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
              min="0"
              required
              step="0.000001"
              type="number"
              value={form.qty}
              onChange={(event) =>
                setForm({ ...form, qty: event.target.value })
              }
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
          UOM
          <select
            className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
            required
            value={form.uomId}
            onChange={(event) =>
              setForm({ ...form, uomId: event.target.value })
            }
          >
            <option value="">Select UOM</option>
            {uoms.map((uom) => (
              <option key={uom.id} value={uom.id}>
                {recordLabel(uom, "code")}
              </option>
            ))}
          </select>
          {selectedItem ? (
            <span className="text-[11px] font-normal text-og-gray">
              Default: {itemBaseUomCode(selectedItem)}
            </span>
          ) : null}
        </label>
        {showCountType ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
            Count Type
            <select
              className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
              required
              value={form.countType}
              onChange={(event) =>
                setForm({
                  ...form,
                  countType: event.target.value as StockCountTypeOption,
                })
              }
            >
              {stockCountTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showReason ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
            Reason
            <select
              className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
              required
              value={form.reasonCodeId}
              onChange={(event) =>
                setForm({ ...form, reasonCodeId: event.target.value })
              }
            >
              <option value="">Select reason</option>
              {reasonCodes.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {recordLabel(reason, "code")}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
          Remarks
          <input
            className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
            type="text"
            value={form.remarks}
            onChange={(event) =>
              setForm({ ...form, remarks: event.target.value })
            }
          />
        </label>
        <button
          className="inline-flex h-10 w-fit items-center gap-2 self-end rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
          disabled={disabled}
          type="submit"
        >
          <Icon name="Save" size={16} />
          Post
        </button>
      </form>
      <div className="overflow-x-auto rounded-md border border-og-line">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Reference", "Date", "Lines", "Status"].map((column) => (
                <th
                  className="px-3 py-2 text-xs font-bold text-og-gray"
                  key={column}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <StateRow
                colSpan={4}
                label={`No ${title.toLowerCase()} records`}
              />
            ) : null}
            {records.map((record) => {
              const expanded = expandedRecordId === record.id;

              return (
                <Fragment key={record.id}>
                  <tr className="border-t border-og-line">
                    <td className="px-3 py-2 font-semibold text-og-dark">
                      {text(record[numberKey])}
                    </td>
                    <td className="px-3 py-2 text-og-dark">
                      {formatDate(record.businessDate)}
                      {record.countType
                        ? ` / ${formatCountType(record.countType)}`
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-og-dark">
                      <button
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-og-line px-2 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green"
                        type="button"
                        onClick={() =>
                          setExpandedRecordId(expanded ? null : record.id)
                        }
                      >
                        <Icon
                          name={expanded ? "ChevronUp" : "ChevronDown"}
                          size={14}
                        />
                        {record.lines.length}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-og-dark">
                      <StatusBadge value={record.status ?? "POSTED"} />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-t border-og-line bg-gray-50">
                      <td className="px-3 py-3" colSpan={4}>
                        <BranchOperationLineDetails record={record} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelTitle({
  compact = false,
  icon,
  title,
}: {
  compact?: boolean;
  icon: IconName;
  title: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${compact ? "" : "border-b border-og-line p-4"}`}
    >
      <Icon name={icon} size={20} className="text-og-green" />
      <h2 className="font-poppins text-xl font-semibold text-og-dark">
        {title}
      </h2>
    </div>
  );
}

function BranchOperationLineDetails({
  record,
}: {
  record: BranchOperationRecord;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-og-line bg-white">
      <table className="w-full min-w-[620px] border-collapse text-left text-xs">
        <thead>
          <tr>
            {["Item", "Qty", "System Qty", "Variance", "UOM", "Reason"].map(
              (column) => (
                <th className="px-3 py-2 font-bold text-og-gray" key={column}>
                  {column}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {record.lines.map((line) => (
            <tr className="border-t border-og-line" key={line.id}>
              <td className="px-3 py-2 font-semibold text-og-dark">
                {recordLabel(line.item, "sku")}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.qty ?? line.countedQty ?? line.qtySold)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.systemQty)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {decimal(line.varianceQty)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {itemBaseUomCode(line.item)}
              </td>
              <td className="px-3 py-2 text-og-dark">
                {record.reasonCode
                  ? recordLabel(record.reasonCode, "code")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchableLocationField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: MasterDataRecord[];
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedOption = options.find((option) => option.id === value);
  const selectedLabel = locationOptionLabel(selectedOption);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((option) =>
        locationOptionLabel(option).toLowerCase().includes(normalizedSearch),
      )
    : options;

  useEffect(() => {
    if (!open) {
      setSearch(selectedLabel);
    }
  }, [open, selectedLabel]);

  function selectOption(option: MasterDataRecord) {
    onChange(option.id);
    setSearch(locationOptionLabel(option));
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1 text-xs font-semibold text-og-dark">
      <label htmlFor={inputId}>{label}</label>
      <input
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
        id={inputId}
        placeholder="Search branch/store"
        role="combobox"
        type="search"
        value={search}
        onBlur={() => {
          setOpen(false);
          setSearch(selectedLabel);
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
        onFocus={(event) => {
          event.currentTarget.select();
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filteredOptions[0]) {
            event.preventDefault();
            selectOption(filteredOptions[0]);
          }
        }}
      />
      {open ? (
        <div
          className="absolute left-0 right-0 top-[64px] z-20 max-h-56 overflow-y-auto rounded-md border border-og-line bg-white py-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                aria-selected={option.id === value}
                className={`block w-full px-3 py-2 text-left text-sm font-normal hover:bg-green-50 ${
                  option.id === value ? "text-og-green" : "text-og-dark"
                }`}
                key={option.id}
                role="option"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
              >
                {locationOptionLabel(option)}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm font-normal text-og-gray">
              No matches
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function inventoryStatus(row: StockOnHandRow) {
  if (row.stockStatus === "OUT_OF_STOCK") {
    return "Out of Stock";
  }

  if (row.stockStatus === "LOW") {
    return "Low";
  }

  if (row.stockStatus === "OK") {
    return "OK";
  }

  if (Number(row.availableQty ?? row.qtyOnHand) <= 0) {
    return "Out of Stock";
  }

  return row.belowLowStock ? "Low" : "OK";
}

function computedLooseCountBaseQty(
  item: MasterDataRecord | undefined,
  form: SimpleForm,
) {
  if (!item) {
    return "";
  }

  const wholeUnits = Number(form.looseWholeUnits || 0);
  const looseQty = Number(form.looseRemainderQty || 0);
  const wholeUnitQty = Number(item.looseWholeUnitQty || 0);
  const looseFactor = looseToBaseFactor(
    relatedCode(item.looseRemainderUom),
    itemBaseUomCode(item),
  );
  const total = wholeUnits * wholeUnitQty + looseQty * looseFactor;

  return Number.isFinite(total) ? String(total) : "";
}

function looseToBaseFactor(fromCode: string, toCode: string) {
  if (fromCode === toCode) {
    return 1;
  }

  const factors: Record<string, number> = {
    "G:KG": 0.001,
    "ML:L": 0.001,
  };

  return factors[`${fromCode}:${toCode}`] ?? 1;
}

function StateRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr className="border-t border-og-line">
      <td className="px-3 py-8 text-center text-og-gray" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

async function clientFromSession() {
  const token = window.localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Sign in again to continue.");
  }

  return new ApiClient(token);
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return Number(value).toLocaleString("en-PH", { maximumFractionDigits: 6 });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatCountType(value: string) {
  const countType = stockCountTypes.find((type) => type.value === value);
  return countType?.label ?? value;
}

function itemBaseUomCode(item: Record<string, unknown> | undefined) {
  if (!item) {
    return "-";
  }

  if (isRecord(item.baseUom) && typeof item.baseUom.code === "string") {
    return item.baseUom.code;
  }

  return "-";
}

function itemBaseUomId(item: Record<string, unknown> | undefined) {
  if (!item) {
    return "";
  }

  return typeof item.baseUomId === "string" ? item.baseUomId : "";
}

function relatedCode(value: unknown) {
  if (!isRecord(value)) {
    return "-";
  }

  return text(value.code ?? value.sku ?? value.name);
}

function validateUomSelection(
  form: SimpleForm,
  items: MasterDataRecord[],
  conversions: MasterDataRecord[],
) {
  const item = items.find((record) => record.id === form.itemId);

  if (!item) {
    throw new Error("Select an item.");
  }

  const baseUomId = itemBaseUomId(item);

  if (!form.uomId) {
    throw new Error("Select a UOM.");
  }

  if (form.uomId === baseUomId) {
    return;
  }

  const conversion = conversions.find(
    (record) => record.fromUomId === form.uomId && record.toUomId === baseUomId,
  );

  if (!conversion) {
    throw new Error(
      `No UOM conversion exists from selected UOM to ${itemBaseUomCode(item)} for ${recordLabel(item, "sku")}.`,
    );
  }
}

function toBaseQty(
  form: SimpleForm,
  items: MasterDataRecord[],
  conversions: MasterDataRecord[],
) {
  const item = items.find((record) => record.id === form.itemId);
  const qty = Number(form.qty || 0);

  if (!item) {
    throw new Error("Select an item.");
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Enter a valid quantity.");
  }

  const baseUomId = itemBaseUomId(item);

  if (form.uomId === baseUomId) {
    return qty;
  }

  const conversion = conversions.find(
    (record) => record.fromUomId === form.uomId && record.toUomId === baseUomId,
  );

  if (!conversion) {
    throw new Error(
      `No UOM conversion exists from selected UOM to ${itemBaseUomCode(item)} for ${recordLabel(item, "sku")}.`,
    );
  }

  return qty * Number(conversion.factor);
}

async function offlineDeviceForLocation(locationId: string) {
  const cached = await getCachedValue<{
    resource: string;
    data: SyncBootstrap;
  }>("api:/sync/bootstrap");
  const device = cached?.value.data.devices.find(
    (candidate) => !candidate.locationId || candidate.locationId === locationId,
  );

  return device?.deviceCode ?? "";
}

function recordLabel(record: Record<string, unknown> | undefined, key: string) {
  if (!record) {
    return "-";
  }

  return text(record[key] ?? record.name ?? record.id);
}

function locationOptionLabel(record: Record<string, unknown> | undefined) {
  if (!record) {
    return "";
  }

  const code = text(record.code);
  const name = text(record.name);

  return name === "-" ? code : `${code} - ${name}`;
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function numberOrUndefined(value: string) {
  return value === "" ? undefined : Number(value);
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
