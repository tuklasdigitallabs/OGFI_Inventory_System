"use client";

import type { FormEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "./data-table";
import { KpiCard } from "./kpi-card";
import { Icon } from "@/lib/icons";
import type { Kpi, Screen } from "@/lib/screens";
import {
  ApiClient,
  getSessionAccessToken,
  type AdjustmentRequest,
  type AuthenticatedUser,
  type LedgerMovementRow,
  type MasterDataRecord,
  type OpeningInventoryImportResult,
  type StockOnHandRow,
} from "@/lib/api-client";

type InventoryLivePageProps = {
  screen: Screen;
};

type InventoryState = {
  adjustmentRequests: AdjustmentRequest[];
  adjustmentReasons: MasterDataRecord[];
  currentUser: AuthenticatedUser | null;
  error: string | null;
  loading: boolean;
  locations: MasterDataRecord[];
  movements: LedgerMovementRow[];
  stock: StockOnHandRow[];
};

type AdjustmentForm = {
  businessDate: string;
  direction: "IN" | "OUT";
  qty: string;
  reasonCodeId: string;
  remarks: string;
  stockKey: string;
  unitCostAtTime: string;
};

type InventoryFilters = {
  categoryId: string;
  itemType: string;
  locationId: string;
  search: string;
  stockStatus: string;
};

type MovementFilters = {
  dateFrom: string;
  dateTo: string;
  locationId: string;
  referenceType: string;
  search: string;
  transactionType: string;
};

type InventoryTab = "stock" | "movements";

const pageSize = 15;

const initialState: InventoryState = {
  adjustmentRequests: [],
  adjustmentReasons: [],
  currentUser: null,
  error: null,
  loading: true,
  locations: [],
  movements: [],
  stock: [],
};

const emptyAdjustmentForm: AdjustmentForm = {
  businessDate: new Date().toISOString().slice(0, 10),
  direction: "OUT",
  qty: "",
  reasonCodeId: "",
  remarks: "",
  stockKey: "",
  unitCostAtTime: "",
};

const emptyFilters: InventoryFilters = {
  categoryId: "",
  itemType: "",
  locationId: "",
  search: "",
  stockStatus: "",
};

const emptyMovementFilters: MovementFilters = {
  dateFrom: "",
  dateTo: "",
  locationId: "",
  referenceType: "",
  search: "",
  transactionType: "",
};

export function InventoryLivePage({ screen }: InventoryLivePageProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>("stock");
  const [state, setState] = useState<InventoryState>(initialState);
  const [draftFilters, setDraftFilters] =
    useState<InventoryFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<InventoryFilters>(emptyFilters);
  const [draftMovementFilters, setDraftMovementFilters] =
    useState<MovementFilters>(emptyMovementFilters);
  const [appliedMovementFilters, setAppliedMovementFilters] =
    useState<MovementFilters>(emptyMovementFilters);
  const [movementPage, setMovementPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [openingImporting, setOpeningImporting] = useState(false);
  const [openingImportResult, setOpeningImportResult] =
    useState<OpeningInventoryImportResult | null>(null);
  const [openingImportForm, setOpeningImportForm] = useState({
    businessDate: new Date().toISOString().slice(0, 10),
    locationId: "",
  });
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [showOpeningImport, setShowOpeningImport] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [stockPage, setStockPage] = useState(1);
  const [adjustmentForm, setAdjustmentForm] =
    useState<AdjustmentForm>(emptyAdjustmentForm);
  const movementSearchInputRef = useRef<HTMLInputElement>(null);
  const openingImportFileRef = useRef<HTMLInputElement>(null);
  const stockSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const stockStatus = normalizeStockStatusFilter(
      searchParams.get("stockStatus") ?? "",
    );

    if (!stockStatus) {
      return;
    }

    const nextFilters = { ...emptyFilters, stockStatus };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setShowFilters(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      const token = getSessionAccessToken();

      if (!token) {
        setState({
          adjustmentRequests: [],
          adjustmentReasons: [],
          currentUser: null,
          error: "Sign in again to load inventory data.",
          loading: false,
          locations: [],
          movements: [],
          stock: [],
        });
        return;
      }

      try {
        const client = new ApiClient(token);
        const user = await client.currentUser();

        if (user.locationIds.length === 0) {
          setState({
            adjustmentRequests: [],
            adjustmentReasons: [],
            currentUser: user,
            error: null,
            loading: false,
            locations: [],
            movements: [],
            stock: [],
          });
          return;
        }

        const canReadAdjustments = user.permissions.includes(
          "inventory.adjustments:read",
        );
        const [
          stockResponses,
          movementResponses,
          adjustmentResponses,
          reasonResponse,
          locationResponse,
        ] =
          await Promise.all([
            Promise.all(
              user.locationIds.map((locationId) =>
                client.stockOnHand(locationId),
              ),
            ),
            Promise.all(
              user.locationIds.map((locationId) =>
                client.inventoryMovements(locationId),
              ),
            ),
            canReadAdjustments
              ? Promise.all(
                  user.locationIds.map((locationId) =>
                    client.adjustmentRequests(locationId),
                  ),
                )
              : Promise.resolve([]),
            client.masterData<MasterDataRecord>("reason-codes"),
            client.masterData<MasterDataRecord>("locations"),
          ]);

        if (cancelled) {
          return;
        }

        const accessibleLocations = locationResponse.data.filter(
          (location) =>
            location.active !== false && user.locationIds.includes(location.id),
        );

        setState({
          adjustmentRequests: adjustmentResponses.flatMap(
            (response) => response.data,
          ),
          adjustmentReasons: reasonResponse.data.filter(
            (reason) =>
              reason.active !== false && String(reason.type) === "ADJUSTMENT",
          ),
          currentUser: user,
          error: null,
          loading: false,
          locations: accessibleLocations,
          movements: movementResponses.flatMap((response) => response.data),
          stock: stockResponses.flatMap((response) => response.data),
        });
        setOpeningImportForm((current) => ({
          ...current,
          locationId: current.locationId || accessibleLocations[0]?.id || "",
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          adjustmentRequests: [],
          adjustmentReasons: [],
          currentUser: null,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load inventory data.",
          loading: false,
          locations: [],
          movements: [],
          stock: [],
        });
      }
    }

    void loadInventory();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStock = useMemo(
    () => applyInventoryFilters(state.stock, appliedFilters),
    [appliedFilters, state.stock],
  );
  const filteredMovements = useMemo(
    () =>
      applyMovementFilters(
        state.movements,
        appliedMovementFilters,
        movementSearchNames(state.stock),
      ).sort(sortMovementsNewestFirst),
    [appliedMovementFilters, state.movements, state.stock],
  );
  const kpis = useMemo(
    () => buildInventoryKpis(filteredStock, state.loading),
    [filteredStock, state.loading],
  );
  const pagedStock = useMemo(
    () => paginate(filteredStock, stockPage),
    [filteredStock, stockPage],
  );
  const pagedMovements = useMemo(
    () => paginate(filteredMovements, movementPage),
    [filteredMovements, movementPage],
  );
  const stockRows = useMemo(
    () => pagedStock.map(toStockTableRow),
    [pagedStock],
  );
  const locationCodes = useMemo(
    () => new Map(state.stock.map((row) => [row.locationId, row.locationCode])),
    [state.stock],
  );
  const itemNames = useMemo(
    () => movementSearchNames(state.stock),
    [state.stock],
  );
  const movementRows = useMemo(
    () =>
      pagedMovements.map((row) =>
        toMovementTableRow(row, locationCodes, itemNames),
      ),
    [itemNames, locationCodes, pagedMovements],
  );
  const selectedAdjustmentStock = useMemo(
    () =>
      state.stock.find(
        (row) => `${row.locationId}:${row.itemId}` === adjustmentForm.stockKey,
      ),
    [adjustmentForm.stockKey, state.stock],
  );

  function openAdjustmentForm() {
    const firstStock = filteredStock[0] ?? state.stock[0];

    setAdjustmentForm({
      ...emptyAdjustmentForm,
      reasonCodeId: state.adjustmentReasons[0]?.id ?? "",
      stockKey: firstStock ? `${firstStock.locationId}:${firstStock.itemId}` : "",
      unitCostAtTime: firstStock?.averageUnitCost ?? "",
    });
    setNotice(null);
    setShowAdjustmentForm(true);
  }

  async function refreshInventory() {
    const token = getSessionAccessToken();

    if (!token) {
      throw new Error("Sign in again to refresh inventory data.");
    }

    const client = new ApiClient(token);
    const user = await client.currentUser();
    const canReadAdjustments = user.permissions.includes(
      "inventory.adjustments:read",
    );
    const [stockResponses, movementResponses, adjustmentResponses] =
      await Promise.all([
        Promise.all(
          user.locationIds.map((locationId) => client.stockOnHand(locationId)),
        ),
        Promise.all(
          user.locationIds.map((locationId) =>
            client.inventoryMovements(locationId),
          ),
        ),
        canReadAdjustments
          ? Promise.all(
              user.locationIds.map((locationId) =>
                client.adjustmentRequests(locationId),
              ),
            )
          : Promise.resolve([]),
      ]);

    setState((current) => ({
      ...current,
      adjustmentRequests: adjustmentResponses.flatMap(
        (response) => response.data,
      ),
      currentUser: user,
      error: null,
      movements: movementResponses.flatMap((response) => response.data),
      stock: stockResponses.flatMap((response) => response.data),
    }));
  }

  async function submitOpeningImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpeningImporting(true);
    setOpeningImportResult(null);
    setNotice(null);

    try {
      const file = openingImportFileRef.current?.files?.[0];

      if (!file) {
        throw new Error("Select an opening inventory workbook.");
      }

      if (!openingImportForm.locationId) {
        throw new Error("Select the branch/store for this opening inventory.");
      }

      const token = getSessionAccessToken();

      if (!token) {
        throw new Error("Sign in again to upload opening inventory.");
      }

      const result = await new ApiClient(token).importOpeningInventory({
        businessDate: openingImportForm.businessDate,
        file,
        locationId: openingImportForm.locationId,
      });

      setOpeningImportResult(result);

      if (result.posted) {
        await refreshInventory();
        setShowOpeningImport(false);
        setNotice(
          `Opening inventory posted: ${result.imported} rows, ${result.stockCountNumber}.`,
        );
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload opening inventory.",
      }));
    } finally {
      setOpeningImporting(false);
      if (openingImportFileRef.current) {
        openingImportFileRef.current.value = "";
      }
    }
  }

  function downloadOpeningImportErrorReport() {
    if (!openingImportResult?.errorReportBase64) {
      return;
    }

    downloadBase64File(
      openingImportResult.errorReportBase64,
      openingImportResult.errorReportFilename ??
        "OGFI_Opening_Inventory_Errors.xlsx",
    );
  }

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAdjustment(true);
    setNotice(null);

    try {
      if (!selectedAdjustmentStock) {
        throw new Error("Select an inventory row to adjust.");
      }

      if (!adjustmentForm.reasonCodeId) {
        throw new Error("Select an adjustment reason.");
      }

      const qty = Number(adjustmentForm.qty);

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("Enter a valid adjustment quantity.");
      }

      const unitCost =
        adjustmentForm.direction === "OUT"
          ? Number(selectedAdjustmentStock.averageUnitCost)
          : Number(adjustmentForm.unitCostAtTime);

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error("Enter a valid unit cost.");
      }

      const token = getSessionAccessToken();

      if (!token) {
        throw new Error("Sign in again to request adjustment.");
      }

      await new ApiClient(token).createAdjustmentRequest({
        businessDate: adjustmentForm.businessDate,
        itemId: selectedAdjustmentStock.itemId,
        locationId: selectedAdjustmentStock.locationId,
        qtyIn: adjustmentForm.direction === "IN" ? qty : undefined,
        qtyOut: adjustmentForm.direction === "OUT" ? qty : undefined,
        reasonCodeId: adjustmentForm.reasonCodeId,
        remarks: adjustmentForm.remarks || undefined,
        unitCostAtTime: unitCost,
      });

      await refreshInventory();
      setShowAdjustmentForm(false);
      setAdjustmentForm(emptyAdjustmentForm);
      setNotice("Adjustment request submitted for approval.");
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to request adjustment.",
      }));
    } finally {
      setSavingAdjustment(false);
    }
  }

  async function approveAdjustmentRequest(id: string) {
    setSavingAdjustment(true);
    setNotice(null);

    try {
      const token = getSessionAccessToken();

      if (!token) {
        throw new Error("Sign in again to approve adjustment.");
      }

      await new ApiClient(token).approveAdjustmentRequest(id);
      await refreshInventory();
      setNotice("Adjustment approved and posted to inventory.");
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to approve adjustment.",
      }));
    } finally {
      setSavingAdjustment(false);
    }
  }

  async function rejectAdjustmentRequest(id: string) {
    const reason = window.prompt("Reason for rejecting this adjustment?");

    if (!reason?.trim()) {
      return;
    }

    setSavingAdjustment(true);
    setNotice(null);

    try {
      const token = getSessionAccessToken();

      if (!token) {
        throw new Error("Sign in again to reject adjustment.");
      }

      await new ApiClient(token).rejectAdjustmentRequest(id, reason.trim());
      await refreshInventory();
      setNotice("Adjustment request rejected.");
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error ? error.message : "Unable to reject adjustment.",
      }));
    } finally {
      setSavingAdjustment(false);
    }
  }

  const canApproveAdjustments =
    state.currentUser?.permissions.includes("inventory.adjustments:approve") ??
    false;
  const canCreateAdjustments =
    state.currentUser?.permissions.includes("inventory.adjustments:create") ??
    false;
  const canPostOpeningInventory =
    state.currentUser?.permissions.includes("ledger.events:post") ?? false;
  const canReadAdjustments =
    state.currentUser?.permissions.includes("inventory.adjustments:read") ??
    false;

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

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark transition hover:border-og-green hover:text-og-green"
            type="button"
            onClick={() => {
              setShowFilters(true);
              window.setTimeout(() => {
                if (activeTab === "stock") {
                  stockSearchInputRef.current?.focus();
                } else {
                  movementSearchInputRef.current?.focus();
                }
              }, 0);
            }}
          >
            <Icon name="Search" size={18} />
            Search
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark transition hover:border-og-green hover:text-og-green"
            type="button"
            onClick={() => setShowFilters((current) => !current)}
          >
            <Icon name="Filter" size={18} />
            Filter
          </button>
          {canCreateAdjustments ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-og-orange bg-og-orange px-3 text-sm font-semibold text-og-dark transition hover:bg-[#e39c14]"
              disabled={state.loading || state.stock.length === 0}
              type="button"
              onClick={openAdjustmentForm}
            >
              <Icon name="SlidersHorizontal" size={18} />
              Adjustment Request
            </button>
          ) : null}
          {canPostOpeningInventory ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark transition hover:border-og-green hover:text-og-green"
              disabled={state.loading}
              type="button"
              onClick={() => {
                setShowOpeningImport((current) => !current);
                setOpeningImportResult(null);
              }}
            >
              <Icon name="FileSpreadsheet" size={18} />
              Opening Inventory
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      {notice ? (
        <div className="rounded-md border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-og-green">
          {notice}
        </div>
      ) : null}

      {showAdjustmentForm ? (
        <AdjustmentRequestForm
          disabled={savingAdjustment}
          form={adjustmentForm}
          reasons={state.adjustmentReasons}
          selectedStock={selectedAdjustmentStock}
          stock={state.stock}
          onCancel={() => setShowAdjustmentForm(false)}
          onChange={setAdjustmentForm}
          onSubmit={submitAdjustment}
        />
      ) : null}

      {showOpeningImport ? (
        <OpeningInventoryImportPanel
          disabled={openingImporting}
          fileInputRef={openingImportFileRef}
          form={openingImportForm}
          locations={state.locations}
          result={openingImportResult}
          onCancel={() => setShowOpeningImport(false)}
          onChange={setOpeningImportForm}
          onDownloadErrorReport={downloadOpeningImportErrorReport}
          onSubmit={submitOpeningImport}
        />
      ) : null}

      {canReadAdjustments ? (
        <AdjustmentRequestsPanel
          canApprove={canApproveAdjustments}
          disabled={savingAdjustment}
          requests={state.adjustmentRequests}
          onApprove={approveAdjustmentRequest}
          onReject={rejectAdjustmentRequest}
        />
      ) : null}

      <InventoryTabs activeTab={activeTab} onChange={setActiveTab} />

      {showFilters ? (
        activeTab === "stock" ? (
          <InventoryFilterBar
            disabled={state.loading}
            filters={draftFilters}
            inputRef={stockSearchInputRef}
            stock={state.stock}
            onApply={() => {
              setAppliedFilters(draftFilters);
              setStockPage(1);
            }}
            onChange={setDraftFilters}
            onClear={() => {
              setDraftFilters(emptyFilters);
              setAppliedFilters(emptyFilters);
              setStockPage(1);
            }}
          />
        ) : (
          <MovementFilterBar
            disabled={state.loading}
            filters={draftMovementFilters}
            inputRef={movementSearchInputRef}
            movements={state.movements}
            stock={state.stock}
            onApply={() => {
              setAppliedMovementFilters(draftMovementFilters);
              setMovementPage(1);
            }}
            onChange={setDraftMovementFilters}
            onClear={() => {
              setDraftMovementFilters(emptyMovementFilters);
              setAppliedMovementFilters(emptyMovementFilters);
              setMovementPage(1);
            }}
          />
        )
      ) : null}

      {activeTab === "stock" ? (
        <PagedDataTable
          columns={[
            "SKU",
            "Item",
            "Location",
            "On Hand",
            "Available",
            "In Transit Out",
            "In Transit In",
            "Avg Cost",
            "Value",
            "Status",
          ]}
          emptyMessage="No stock balances found"
          error={state.error}
          loading={state.loading}
          page={stockPage}
          rows={stockRows}
          title="Stock On Hand"
          totalRows={filteredStock.length}
          onPageChange={setStockPage}
        />
      ) : (
        <PagedDataTable
          columns={[
            "Date",
            "Item",
            "Type",
            "Location",
            "Qty",
            "Unit Cost",
            "Extended",
            "Reference",
            "Status",
          ]}
          emptyMessage="No inventory movements found"
          error={state.error}
          loading={state.loading}
          page={movementPage}
          rows={movementRows}
          title="Inventory Movements"
          totalRows={filteredMovements.length}
          onPageChange={setMovementPage}
        />
      )}
    </div>
  );
}

function InventoryFilterBar({
  disabled,
  filters,
  inputRef,
  onApply,
  onChange,
  onClear,
  stock,
}: {
  disabled: boolean;
  filters: InventoryFilters;
  inputRef: RefObject<HTMLInputElement | null>;
  onApply: () => void;
  onChange: (filters: InventoryFilters) => void;
  onClear: () => void;
  stock: StockOnHandRow[];
}) {
  const hasFilters = Object.values(filters).some(Boolean);
  const locations = uniqueOptions(
    stock.map((row) => ({
      label: row.locationCode,
      value: row.locationId,
    })),
  );
  const categories = uniqueOptions(
    stock
      .filter((row) => row.categoryId)
      .map((row) => ({
        label: row.categoryName ?? row.categoryId ?? "",
        value: row.categoryId ?? "",
      })),
  );
  const itemTypes = uniqueOptions(
    stock
      .filter((row) => row.itemType)
      .map((row) => ({
        label: formatItemType(row.itemType),
        value: row.itemType,
      })),
  );

  function updateFilter(key: keyof InventoryFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="og-card">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <label className="min-w-[260px] flex-1">
          <span className="mb-1 block text-xs font-semibold text-og-gray">
            Search
          </span>
          <span className="flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 focus-within:border-og-green">
            <Icon name="Search" size={18} className="text-og-gray" />
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              disabled={disabled}
              placeholder="Search SKU, item, location, category, or status"
              ref={inputRef}
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </span>
        </label>

        <InventorySelect
          disabled={disabled}
          label="Location"
          options={locations}
          value={filters.locationId}
          onChange={(value) => updateFilter("locationId", value)}
        />
        <InventorySelect
          disabled={disabled}
          label="Category"
          options={categories}
          value={filters.categoryId}
          onChange={(value) => updateFilter("categoryId", value)}
        />
        <InventorySelect
          disabled={disabled}
          label="Item type"
          options={itemTypes}
          value={filters.itemType}
          onChange={(value) => updateFilter("itemType", value)}
        />
        <InventorySelect
          disabled={disabled}
          label="Stock status"
          options={[
            { label: "Low or empty", value: "LOW_OR_EMPTY" },
            { label: "Low", value: "LOW" },
            { label: "Out of stock", value: "OUT_OF_STOCK" },
            { label: "OK", value: "OK" },
          ]}
          value={filters.stockStatus}
          onChange={(value) => updateFilter("stockStatus", value)}
        />

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          <Icon name="Filter" size={18} />
          Apply
        </button>
        <button
          className="inline-flex h-10 items-center rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-gray hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || !hasFilters}
          type="button"
          onClick={onClear}
        >
          Clear
        </button>
      </form>
    </section>
  );
}

function MovementFilterBar({
  disabled,
  filters,
  inputRef,
  movements,
  onApply,
  onChange,
  onClear,
  stock,
}: {
  disabled: boolean;
  filters: MovementFilters;
  inputRef: RefObject<HTMLInputElement | null>;
  movements: LedgerMovementRow[];
  onApply: () => void;
  onChange: (filters: MovementFilters) => void;
  onClear: () => void;
  stock: StockOnHandRow[];
}) {
  const hasFilters = Object.values(filters).some(Boolean);
  const locationLabels = new Map(
    stock.map((row) => [row.locationId, row.locationCode]),
  );
  const locations = uniqueOptions(
    movements.map((row) => ({
      label: locationLabels.get(row.locationId) ?? row.locationId.slice(0, 8),
      value: row.locationId,
    })),
  );
  const transactionTypes = uniqueOptions(
    movements.map((row) => ({
      label: row.transactionType,
      value: row.transactionType,
    })),
  );
  const referenceTypes = uniqueOptions(
    movements.map((row) => ({
      label: row.referenceType,
      value: row.referenceType,
    })),
  );

  function updateFilter(key: keyof MovementFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="og-card">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <label className="min-w-[260px] flex-1">
          <span className="mb-1 block text-xs font-semibold text-og-gray">
            Search
          </span>
          <span className="flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 focus-within:border-og-green">
            <Icon name="Search" size={18} className="text-og-gray" />
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              disabled={disabled}
              placeholder="Search item, movement, location, or reference"
              ref={inputRef}
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </span>
        </label>

        <InventorySelect
          disabled={disabled}
          label="Location"
          options={locations}
          value={filters.locationId}
          onChange={(value) => updateFilter("locationId", value)}
        />
        <InventorySelect
          disabled={disabled}
          label="Movement"
          options={transactionTypes}
          value={filters.transactionType}
          onChange={(value) => updateFilter("transactionType", value)}
        />
        <InventorySelect
          disabled={disabled}
          label="Reference"
          options={referenceTypes}
          value={filters.referenceType}
          onChange={(value) => updateFilter("referenceType", value)}
        />

        <DateInput
          disabled={disabled}
          label="From"
          value={filters.dateFrom}
          onChange={(value) => updateFilter("dateFrom", value)}
        />
        <DateInput
          disabled={disabled}
          label="To"
          value={filters.dateTo}
          onChange={(value) => updateFilter("dateTo", value)}
        />

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          <Icon name="Filter" size={18} />
          Apply
        </button>
        <button
          className="inline-flex h-10 items-center rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-gray hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || !hasFilters}
          type="button"
          onClick={onClear}
        >
          Clear
        </button>
      </form>
    </section>
  );
}

function AdjustmentRequestForm({
  disabled,
  form,
  reasons,
  selectedStock,
  stock,
  onCancel,
  onChange,
  onSubmit,
}: {
  disabled: boolean;
  form: AdjustmentForm;
  reasons: MasterDataRecord[];
  selectedStock?: StockOnHandRow;
  stock: StockOnHandRow[];
  onCancel: () => void;
  onChange: (form: AdjustmentForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function update(patch: Partial<AdjustmentForm>) {
    onChange({ ...form, ...patch });
  }

  function selectStock(stockKey: string) {
    const row = stock.find(
      (stockRow) => `${stockRow.locationId}:${stockRow.itemId}` === stockKey,
    );

    update({
      stockKey,
      unitCostAtTime: row?.averageUnitCost ?? form.unitCostAtTime,
    });
  }

  return (
    <section className="og-card">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-poppins text-lg font-semibold text-og-dark">
              Adjustment Request
            </h2>
            <p className="text-sm text-og-gray">
              Post an inventory increase or decrease with reason and remarks.
            </p>
          </div>
          {selectedStock ? (
            <div className="rounded-md border border-og-line bg-og-surface px-3 py-2 text-sm text-og-gray">
              <span className="font-semibold text-og-dark">
                {selectedStock.sku}
              </span>{" "}
              at {selectedStock.locationCode}:{" "}
              {formatQuantity(selectedStock.availableQty ?? selectedStock.qtyOnHand)}{" "}
              {selectedStock.baseUomCode.toLowerCase()} available
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Inventory row
            </span>
            <select
              className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
              disabled={disabled}
              required
              value={form.stockKey}
              onChange={(event) => selectStock(event.target.value)}
            >
              <option value="">Select inventory row</option>
              {stock.map((row) => {
                const value = `${row.locationId}:${row.itemId}`;

                return (
                  <option key={value} value={value}>
                    {row.locationCode} / {row.sku} - {row.itemName}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Direction
            </span>
            <select
              className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
              disabled={disabled}
              value={form.direction}
              onChange={(event) =>
                update({ direction: event.target.value as "IN" | "OUT" })
              }
            >
              <option value="OUT">Decrease stock</option>
              <option value="IN">Increase stock</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Qty
            </span>
            <input
              className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
              disabled={disabled}
              min="0.000001"
              required
              step="0.000001"
              type="number"
              value={form.qty}
              onChange={(event) => update({ qty: event.target.value })}
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Unit cost
            </span>
            <input
              className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green disabled:bg-og-surface"
              disabled={disabled || form.direction === "OUT"}
              min="0"
              required
              step="0.01"
              type="number"
              value={form.unitCostAtTime}
              onChange={(event) =>
                update({ unitCostAtTime: event.target.value })
              }
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Reason
            </span>
            <select
              className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
              disabled={disabled}
              required
              value={form.reasonCodeId}
              onChange={(event) => update({ reasonCodeId: event.target.value })}
            >
              <option value="">Select reason</option>
              {reasons.map((reason) => (
                <option key={String(reason.id)} value={String(reason.id)}>
                  {String(reason.code ?? reason.name)} - {String(reason.name)}
                </option>
              ))}
            </select>
          </label>

          <DateInput
            disabled={disabled}
            label="Business date"
            value={form.businessDate}
            onChange={(value) => update({ businessDate: value })}
          />

          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Remarks
            </span>
            <input
              className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
              disabled={disabled}
              type="text"
              value={form.remarks}
              onChange={(event) => update({ remarks: event.target.value })}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            type="submit"
          >
            <Icon name="Save" size={18} />
            Submit Request
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-4 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            type="button"
            onClick={onCancel}
          >
            <Icon name="X" size={18} />
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function AdjustmentRequestsPanel({
  canApprove,
  disabled,
  requests,
  onApprove,
  onReject,
}: {
  canApprove: boolean;
  disabled: boolean;
  requests: AdjustmentRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const visibleRequests = requests.slice(0, 8);

  return (
    <section className="og-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-poppins text-lg font-semibold text-og-dark">
            Adjustment Requests
          </h2>
          <p className="text-sm text-og-gray">
            Pending requests need approval before stock is changed.
          </p>
        </div>
        <span className="rounded-md border border-og-line px-2 py-1 text-xs font-semibold uppercase text-og-gray">
          {formatInteger(
            requests.filter((request) => request.status === "PENDING_APPROVAL")
              .length,
          )}{" "}
          pending
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-og-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-og-surface text-xs font-semibold uppercase text-og-gray">
            <tr>
              <th className="px-3 py-2">Request</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-og-gray" colSpan={7}>
                  No adjustment requests found.
                </td>
              </tr>
            ) : (
              visibleRequests.map((request) => {
                const pending = request.status === "PENDING_APPROVAL";

                return (
                  <tr className="border-t border-og-line" key={request.id}>
                    <td className="px-3 py-2 font-semibold text-og-dark">
                      {request.requestNumber}
                    </td>
                    <td className="px-3 py-2">
                      {String(request.item?.sku ?? request.itemId)}
                    </td>
                    <td className="px-3 py-2">
                      {String(request.location?.code ?? request.locationId)}
                    </td>
                    <td className="px-3 py-2">
                      {adjustmentQtyLabel(request)}
                    </td>
                    <td className="px-3 py-2">
                      {String(request.reasonCode?.name ?? "-")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={adjustmentStatusClass(request.status)}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {pending && canApprove ? (
                          <>
                            <button
                              className="rounded-md border border-og-green px-2 py-1 text-xs font-semibold text-og-green disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={disabled}
                              type="button"
                              onClick={() => onApprove(request.id)}
                            >
                              Approve
                            </button>
                            <button
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={disabled}
                              type="button"
                              onClick={() => onReject(request.id)}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-og-gray">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InventoryTabs({
  activeTab,
  onChange,
}: {
  activeTab: InventoryTab;
  onChange: (tab: InventoryTab) => void;
}) {
  return (
    <section className="inline-flex w-fit rounded-md border border-og-line bg-white p-1">
      {[
        { label: "Stock On Hand", value: "stock" },
        { label: "Inventory Movements", value: "movements" },
      ].map((tab) => (
        <button
          className={`rounded px-3 py-2 text-sm font-semibold transition ${
            activeTab === tab.value
              ? "bg-green-50 text-og-green"
              : "text-og-gray hover:text-og-dark"
          }`}
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value as InventoryTab)}
        >
          {tab.label}
        </button>
      ))}
    </section>
  );
}

function OpeningInventoryImportPanel({
  disabled,
  fileInputRef,
  form,
  locations,
  result,
  onCancel,
  onChange,
  onDownloadErrorReport,
  onSubmit,
}: {
  disabled: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  form: { businessDate: string; locationId: string };
  locations: MasterDataRecord[];
  result: OpeningInventoryImportResult | null;
  onCancel: () => void;
  onChange: (form: { businessDate: string; locationId: string }) => void;
  onDownloadErrorReport: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="og-card">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-poppins text-lg font-semibold text-og-dark">
              Opening Inventory Upload
            </h2>
            <p className="text-sm text-og-gray">
              Upload the client month-end count sheet as the branch beginning
              inventory.
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            type="button"
            onClick={onCancel}
          >
            <Icon name="X" size={16} />
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_170px_minmax(220px,1fr)]">
          <label>
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Branch / Store
            </span>
            <select
              className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
              disabled={disabled}
              required
              value={form.locationId}
              onChange={(event) =>
                onChange({ ...form, locationId: event.target.value })
              }
            >
              <option value="">Select branch/store</option>
              {locations.map((location) => (
                <option key={String(location.id)} value={String(location.id)}>
                  {String(location.code ?? location.name)} -{" "}
                  {String(location.name ?? "")}
                </option>
              ))}
            </select>
          </label>
          <DateInput
            disabled={disabled}
            label="Business date"
            value={form.businessDate}
            onChange={(businessDate) => onChange({ ...form, businessDate })}
          />
          <label>
            <span className="mb-1 block text-xs font-semibold text-og-gray">
              Excel file
            </span>
            <input
              ref={fileInputRef}
              accept=".xlsx"
              className="block h-10 w-full rounded-md border border-og-line bg-white px-3 py-2 text-sm focus:border-og-green"
              disabled={disabled}
              required
              type="file"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            type="submit"
          >
            <Icon name="Upload" size={18} />
            {disabled ? "Uploading" : "Upload Opening Inventory"}
          </button>
        </div>
      </form>

      {result ? (
        <div className="mt-4 rounded-md border border-og-line bg-og-surface p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-og-dark">
                {result.posted
                  ? `Posted ${result.imported} rows to ${result.stockCountNumber}.`
                  : `Import check finished: ${result.imported} imported, ${result.failed} failed.`}
              </p>
              {result.failed > 0 ? (
                <p className="mt-1 text-sm text-og-gray">
                  Fix the downloadable error workbook, then upload it again.
                </p>
              ) : null}
            </div>
            {result.errorReportBase64 ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark transition hover:border-og-green"
                onClick={onDownloadErrorReport}
                type="button"
              >
                <Icon name="FileSpreadsheet" size={16} />
                Error Report
              </button>
            ) : null}
          </div>
          {result.errors.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-og-gray">
              {result.errors.slice(0, 3).map((error) => (
                <li key={`${error.sheet}-${error.row}`}>
                  <span className="font-semibold text-og-dark">
                    {error.sheet} row {error.row}:
                  </span>{" "}
                  {error.errors.join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PagedDataTable({
  columns,
  emptyMessage,
  error,
  loading,
  page,
  rows,
  title,
  totalRows,
  onPageChange,
}: {
  columns: string[];
  emptyMessage: string;
  error?: string | null;
  loading: boolean;
  page: number;
  rows: string[][];
  title: string;
  totalRows: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRows);

  useEffect(() => {
    if (page > totalPages) {
      onPageChange(totalPages);
    }
  }, [onPageChange, page, totalPages]);

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={columns}
        emptyMessage={emptyMessage}
        error={error}
        loading={loading}
        rows={rows}
        title={title}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-og-line bg-white px-3 py-2 text-sm text-og-gray">
        <span>
          Showing {formatInteger(start)}-{formatInteger(end)} of{" "}
          {formatInteger(totalRows)}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="h-9 rounded-md border border-og-line px-3 font-semibold text-og-dark disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || currentPage <= 1}
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>
          <span className="font-semibold text-og-dark">
            Page {formatInteger(currentPage)} of {formatInteger(totalPages)}
          </span>
          <button
            className="h-9 rounded-md border border-og-line px-3 font-semibold text-og-dark disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || currentPage >= totalPages}
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function InventorySelect({
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
    <label className="min-w-[160px]">
      <span className="mb-1 block text-xs font-semibold text-og-gray">
        {label}
      </span>
      <select
        className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateInput({
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
    <label className="min-w-[150px]">
      <span className="mb-1 block text-xs font-semibold text-og-gray">
        {label}
      </span>
      <input
        className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green"
        disabled={disabled}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function buildInventoryKpis(
  stock: StockOnHandRow[],
  loading = false,
): Kpi[] {
  const positiveBalances = stock.filter(
    (row) => Number(row.availableQty ?? row.qtyOnHand) > 0,
  ).length;
  const lowStock = stock.filter((row) => inventoryStatus(row) === "Low").length;
  const emptyStock = stock.filter(
    (row) => inventoryStatus(row) === "Out of Stock",
  ).length;
  const totalValue = stock.reduce(
    (total, row) => total + Number(row.inventoryValue),
    0,
  );

  return [
    {
      label: "Available Stock",
      value: loading ? "..." : formatInteger(positiveBalances),
      meta: "Positive-balance item/location rows",
      icon: "CircleCheck",
      tone: "success",
    },
    {
      label: "Stock Alerts",
      value: loading
        ? "..."
        : `Low ${formatInteger(lowStock)} / Empty ${formatInteger(emptyStock)}`,
      meta: "Low and empty inventory rows",
      icon: "AlertTriangle",
      tone: emptyStock > 0 ? "danger" : lowStock > 0 ? "warning" : "success",
    },
    {
      label: "Stock Value",
      value: loading ? "..." : formatCurrency(totalValue),
      meta: "Computed from moving average cost",
      icon: "Coins",
      tone: "info",
    },
  ];
}

function toStockTableRow(row: StockOnHandRow) {
  const qty =
    row.displayQty ??
    `${formatQuantity(row.qtyOnHand)} ${row.baseUomCode.toLowerCase()}`;
  const availableQty =
    row.displayAvailableQty ??
    `${formatQuantity(row.availableQty ?? row.qtyOnHand)} ${row.baseUomCode.toLowerCase()}`;
  const status = inventoryStatus(row);

  return [
    row.sku,
    row.itemName,
    row.locationCode,
    qty,
    availableQty,
    `${formatQuantity(row.reservedOutQty ?? "0")} ${row.baseUomCode.toLowerCase()}`,
    `${formatQuantity(row.inTransitInQty ?? "0")} ${row.baseUomCode.toLowerCase()}`,
    formatCurrency(Number(row.averageUnitCost)),
    formatCurrency(Number(row.inventoryValue)),
    status,
  ];
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

function applyInventoryFilters(
  stock: StockOnHandRow[],
  filters: InventoryFilters,
) {
  const search = filters.search.trim().toLowerCase();

  return stock.filter((row) => {
    if (filters.locationId && row.locationId !== filters.locationId) {
      return false;
    }

    if (filters.categoryId && row.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.itemType && row.itemType !== filters.itemType) {
      return false;
    }

    if (
      filters.stockStatus === "LOW_OR_EMPTY" &&
      !["Low", "Out of Stock"].includes(inventoryStatus(row))
    ) {
      return false;
    }

    if (filters.stockStatus === "LOW" && inventoryStatus(row) !== "Low") {
      return false;
    }

    if (
      filters.stockStatus === "OUT_OF_STOCK" &&
      inventoryStatus(row) !== "Out of Stock"
    ) {
      return false;
    }

    if (filters.stockStatus === "OK" && inventoryStatus(row) !== "OK") {
      return false;
    }

    if (search && !stockSearchText(row).includes(search)) {
      return false;
    }

    return true;
  });
}

function applyMovementFilters(
  movements: LedgerMovementRow[],
  filters: MovementFilters,
  itemNames: Map<string, string>,
) {
  const search = filters.search.trim().toLowerCase();

  return movements.filter((row) => {
    if (filters.locationId && row.locationId !== filters.locationId) {
      return false;
    }

    if (
      filters.transactionType &&
      row.transactionType !== filters.transactionType
    ) {
      return false;
    }

    if (filters.referenceType && row.referenceType !== filters.referenceType) {
      return false;
    }

    if (
      filters.dateFrom &&
      dateInputValue(row.businessDate) < filters.dateFrom
    ) {
      return false;
    }

    if (filters.dateTo && dateInputValue(row.businessDate) > filters.dateTo) {
      return false;
    }

    if (search && !movementSearchText(row, itemNames).includes(search)) {
      return false;
    }

    return true;
  });
}

function normalizeStockStatusFilter(value: string) {
  const normalized = value.trim().toUpperCase();

  return ["LOW_OR_EMPTY", "LOW", "OUT_OF_STOCK", "OK"].includes(normalized)
    ? normalized
    : "";
}

function stockSearchText(row: StockOnHandRow) {
  return [
    row.sku,
    row.itemName,
    row.locationCode,
    row.locationName,
    row.categoryName,
    row.itemType,
    row.availableQty,
    row.reservedOutQty,
    row.inTransitInQty,
    inventoryStatus(row),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function movementSearchText(
  row: LedgerMovementRow,
  itemNames: Map<string, string>,
) {
  return [
    formatDate(row.businessDate),
    itemNames.get(row.itemId),
    row.itemId,
    row.locationId,
    row.transactionType,
    row.referenceType,
    row.referenceId,
    row.qtyIn,
    row.qtyOut,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function movementSearchNames(stock: StockOnHandRow[]) {
  const names = new Map<string, string>();

  for (const row of stock) {
    if (!names.has(row.itemId)) {
      names.set(row.itemId, `${row.sku} ${row.itemName}`);
    }
  }

  return names;
}

function toMovementTableRow(
  row: LedgerMovementRow,
  locationCodes: Map<string, string>,
  itemNames: Map<string, string>,
) {
  const qtyIn = Number(row.qtyIn);
  const qtyOut = Number(row.qtyOut);
  const qty =
    qtyIn > 0
      ? `+${formatQuantity(row.qtyIn)}`
      : `-${formatQuantity(row.qtyOut)}`;

  return [
    formatDate(row.businessDate),
    itemNames.get(row.itemId) ?? row.itemId.slice(0, 8),
    row.transactionType,
    locationCodes.get(row.locationId) ?? row.locationId.slice(0, 8),
    qty,
    formatCurrency(Number(row.unitCostAtTime)),
    formatCurrency(Number(row.extendedCost)),
    `${row.referenceType}:${row.referenceId.slice(0, 8)}`,
    "Posted",
  ];
}

function adjustmentQtyLabel(request: AdjustmentRequest) {
  const qtyIn = Number(request.qtyIn);
  const qtyOut = Number(request.qtyOut);
  const direction = qtyIn > 0 ? "+" : "-";
  const qty = qtyIn > 0 ? request.qtyIn : request.qtyOut;
  const uom = String(request.item?.baseUom?.code ?? "").toLowerCase();

  return `${direction}${formatQuantity(qty)}${uom ? ` ${uom}` : ""}`;
}

function adjustmentStatusClass(status: string) {
  const base =
    "inline-flex rounded-md border px-2 py-1 text-xs font-semibold uppercase";

  if (status === "PENDING_APPROVAL") {
    return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  }

  if (status === "POSTED" || status === "APPROVED") {
    return `${base} border-green-200 bg-green-50 text-og-green`;
  }

  if (status === "REJECTED") {
    return `${base} border-red-200 bg-red-50 text-red-700`;
  }

  return `${base} border-og-line bg-og-surface text-og-gray`;
}

function paginate<T>(rows: T[], page: number) {
  const start = (page - 1) * pageSize;

  return rows.slice(start, start + pageSize);
}

function sortMovementsNewestFirst(
  left: LedgerMovementRow,
  right: LedgerMovementRow,
) {
  return (
    new Date(right.businessDate).getTime() -
    new Date(left.businessDate).getTime()
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 3,
  }).format(Number(value));
}

function uniqueOptions(options: Array<{ label: string; value: string }>) {
  const optionMap = new Map<string, string>();

  for (const option of options) {
    if (option.value && !optionMap.has(option.value)) {
      optionMap.set(option.value, option.label);
    }
  }

  return [...optionMap.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function downloadBase64File(base64: string, filename: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function formatItemType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
