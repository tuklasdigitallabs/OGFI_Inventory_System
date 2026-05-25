"use client";

import {
  Fragment,
  FormEvent,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Icon } from "@/lib/icons";
import type { Kpi, Screen } from "@/lib/screens";
import {
  ApiClient,
  TOKEN_KEY,
  type AuthenticatedUser,
  type MasterDataRecord,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type Receiving,
} from "@/lib/api-client";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

type PurchasingLivePageProps = {
  screen: Screen;
};

type ResourceState = {
  items: MasterDataRecord[];
  locations: MasterDataRecord[];
  supplierItems: MasterDataRecord[];
  suppliers: MasterDataRecord[];
  uoms: MasterDataRecord[];
};

type PurchaseOrderLineForm = {
  costLoaded: boolean;
  costOverrideReason: string;
  defaultUnitCost: string;
  itemId: string;
  lineId: string;
  qty: string;
  supplierItemId: string;
  unitCost: string;
  uomId: string;
};

type PurchaseOrderForm = {
  currentLine: PurchaseOrderLineForm;
  editingLineId: string;
  editingId: string;
  expectedDate: string;
  lines: PurchaseOrderLineForm[];
  locationId: string;
  remarks: string;
  supplierId: string;
};

type ReceivingForm = {
  changeReason: string;
  drReference: string;
  invoiceReference: string;
  lines: ReceivingLineForm[];
  purchaseOrderId: string;
};

type ReceivingLineForm = {
  acceptedQty: string;
  itemId: string;
  lineId: string;
  rejectedQty: string;
  remarks: string;
};

type PurchaseOrderFilters = {
  expectedDate: string;
  locationId: string;
  search: string;
  status: string;
  supplierId: string;
};

const emptyResources: ResourceState = {
  items: [],
  locations: [],
  supplierItems: [],
  suppliers: [],
  uoms: [],
};

function createPurchaseOrderLineForm(
  itemId = "",
  uomId = "",
): PurchaseOrderLineForm {
  return {
    costLoaded: false,
    costOverrideReason: "",
    defaultUnitCost: "",
    itemId,
    lineId: `po-line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    qty: "1",
    supplierItemId: "",
    unitCost: "",
    uomId,
  };
}

function createPurchaseOrderForm(): PurchaseOrderForm {
  return {
    currentLine: createPurchaseOrderLineForm(),
    editingLineId: "",
    editingId: "",
    expectedDate: "",
    lines: [],
    locationId: "",
    remarks: "",
    supplierId: "",
  };
}

const emptyReceivingForm: ReceivingForm = {
  changeReason: "",
  drReference: "",
  invoiceReference: "",
  lines: [],
  purchaseOrderId: "",
};

const emptyPurchaseOrderFilters: PurchaseOrderFilters = {
  expectedDate: "",
  locationId: "",
  search: "",
  status: "",
  supplierId: "",
};

const purchaseOrderStatuses = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "POSTED",
  "CLOSED",
  "REJECTED",
].map((status) => ({ label: status, value: status }));

function normalizePurchaseOrderStatus(value: string) {
  const normalized = value.trim().toUpperCase();

  return purchaseOrderStatuses.some((status) => status.value === normalized)
    ? normalized
    : "";
}

export function PurchasingLivePage({ screen }: PurchasingLivePageProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [resources, setResources] = useState<ResourceState>(emptyResources);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [poForm, setPoForm] = useState<PurchaseOrderForm>(() =>
    createPurchaseOrderForm(),
  );
  const [poFilters, setPoFilters] = useState<PurchaseOrderFilters>(
    emptyPurchaseOrderFilters,
  );
  const [receivingForm, setReceivingForm] =
    useState<ReceivingForm>(emptyReceivingForm);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  const isReceiving = screen.slug === "receiving";
  const canCreatePurchaseOrder = hasPermission(
    user,
    "purchasing.purchase-orders:create",
  );
  const canApprovePurchaseOrder = hasPermission(
    user,
    "purchasing.purchase-orders:approve",
  );
  const canReceiveGoods = hasPermission(user, "purchasing.receivings:create");
  const showReceivingForm =
    canReceiveGoods && (isReceiving || selectedOrder !== null);

  useEffect(() => {
    const status = normalizePurchaseOrderStatus(
      new URLSearchParams(window.location.search).get("status") ?? "",
    );

    if (status) {
      setPoFilters((current) => ({ ...current, status }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPurchasing() {
      const token = window.localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setTableError("Sign in again to load purchasing data.");
        setLoading(false);
        return;
      }

      try {
        const client = new ApiClient(token);
        const [user, suppliers, supplierItems, locations, items, uoms, purchaseOrders] =
          await Promise.all([
            client.currentUser(),
            client.masterData<MasterDataRecord>("suppliers"),
            client.masterData<MasterDataRecord>("supplier-items"),
            client.masterData<MasterDataRecord>("locations"),
            client.masterData<MasterDataRecord>("items"),
            client.masterData<MasterDataRecord>("uoms"),
            client.purchaseOrders(),
          ]);

        if (cancelled) {
          return;
        }

        const allowedLocations = locations.data.filter(
          (location) =>
            location.active !== false && user.locationIds.includes(location.id),
        );
        const activeSuppliers = suppliers.data.filter(
          (supplier) => supplier.active !== false,
        );
        const activeItems = items.data.filter((item) => item.active !== false);
        const activeUoms = uoms.data.filter((uom) => uom.active !== false);
        const firstItemUomId =
          itemBaseUomId(activeItems[0]) || activeUoms[0]?.id || "";

        setResources({
          items: activeItems,
          locations: allowedLocations,
          supplierItems: supplierItems.data.filter(
            (supplierItem) => supplierItem.active !== false,
          ),
          suppliers: activeSuppliers,
          uoms: activeUoms,
        });
        setUser(user);
        setOrders(purchaseOrders.data);
        setPoForm((current) => ({
          ...current,
          currentLine: current.currentLine.itemId
            ? current.currentLine
            : createPurchaseOrderLineForm("", firstItemUomId),
        }));
        setTableError(null);
        setLoading(false);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setTableError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load purchasing data.",
        );
        setLoading(false);
      }
    }

    void loadPurchasing();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selectedLine = selectedOrder?.lines?.[0];

    if (!selectedOrder || !selectedLine) {
      return;
    }

    setReceivingForm((current) => ({
      ...current,
      lines:
        current.purchaseOrderId === selectedOrder.id && current.lines.length > 0
          ? current.lines
          : (selectedOrder.lines ?? []).map((line) => ({
              acceptedQty: line.remainingQty ?? line.qty,
              itemId: line.itemId,
              lineId: line.id,
              rejectedQty: "0",
              remarks: "",
            })),
      purchaseOrderId: selectedOrder.id,
    }));
  }, [selectedOrder]);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultCost() {
      const line = poForm.currentLine;

      if (!poForm.supplierId || !line.itemId || line.costLoaded) {
        return;
      }

      try {
        const client = await clientFromSession();
        const supplierCost = await client.supplierItemCost(
          poForm.supplierId,
          line.itemId,
          line.supplierItemId || undefined,
        );

        if (cancelled) {
          return;
        }

        setPoForm((current) => {
          if (
            current.supplierId !== poForm.supplierId ||
            current.currentLine.lineId !== line.lineId
          ) {
            return current;
          }

          const unitCost = supplierCost.unitCost ?? "";

          return {
            ...current,
            currentLine: {
              ...current.currentLine,
              costLoaded: true,
              costOverrideReason: "",
              defaultUnitCost: unitCost,
              unitCost,
            },
          };
        });
      } catch (costError) {
        if (cancelled) {
          return;
        }

        setError(
          costError instanceof Error
            ? costError.message
            : "Unable to load supplier item cost.",
        );
      }
    }

    void loadDefaultCost();

    return () => {
      cancelled = true;
    };
  }, [poForm.currentLine, poForm.supplierId]);

  const orderOptions = useMemo(
    () =>
      orders.filter((order) =>
        ["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status),
      ),
    [orders],
  );

  const kpis = useMemo<Kpi[]>(
    () => [
      {
        label: "Draft POs",
        value: countStatus(orders, "DRAFT"),
        meta: "Editable purchase orders",
        icon: "FileText",
        tone: "neutral" as const,
      },
      {
        label: "Awaiting Approval",
        value: countStatus(orders, "PENDING_APPROVAL"),
        meta: "Submitted purchase orders",
        icon: "Clock",
        tone: "warning" as const,
      },
      {
        label: "Ready To Receive",
        value: String(orderOptions.length),
        meta: "Approved or partial POs",
        icon: "PackageCheck",
        tone: "success" as const,
      },
    ],
    [orderOptions.length, orders],
  );

  async function refresh(client: ApiClient) {
    const purchaseOrders = await client.purchaseOrders();
    setOrders(purchaseOrders.data);
  }

  async function clientFromSession() {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      throw new Error("Sign in again to continue.");
    }

    return new ApiClient(token);
  }

  async function savePurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validatePurchaseOrderForm(poForm);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();
      const payload = {
        supplierId: poForm.supplierId,
        locationId: poForm.locationId,
        expectedDate: poForm.expectedDate
          ? new Date(poForm.expectedDate).toISOString()
          : undefined,
        remarks: poForm.remarks || undefined,
        lines: poForm.lines.map((line) => ({
          itemId: line.itemId,
          supplierItemId: line.supplierItemId || undefined,
          qty: Number(line.qty),
          uomId: line.uomId,
          unitCost: Number(line.unitCost),
          costOverrideReason:
            isCostOverride(line) && line.costOverrideReason
              ? line.costOverrideReason
              : undefined,
        })),
      };

      if (poForm.editingId) {
        await client.updatePurchaseOrder(poForm.editingId, payload);
      } else {
        await client.createPurchaseOrder(payload);
      }

      await refresh(client);
      setPoForm(createPurchaseOrderForm());
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save purchase order.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function transitionOrder(
    id: string,
    action: "approve" | "close" | "reject" | "submit",
  ) {
    const closeReason =
      action === "close"
        ? window.prompt("Reason for closing the remaining balance:")
        : null;

    if (action === "close" && !closeReason?.trim()) {
      setError("Close balance reason is required.");
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();

      if (action === "submit") {
        await client.submitPurchaseOrder(id);
      } else if (action === "approve") {
        await client.approvePurchaseOrder(id);
      } else if (action === "reject") {
        await client.rejectPurchaseOrder(
          id,
          "Rejected from purchasing screen.",
        );
      } else {
        await client.closePurchaseOrderBalance(id, closeReason!.trim());
      }

      await refresh(client);
      setError(null);
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : "Unable to update purchase order.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadOrderForReceiving(id: string) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      const detail = await client.purchaseOrder(id);

      setSelectedOrder(detail);
      setReceivingForm({
        ...emptyReceivingForm,
        lines:
          detail.lines?.map((line) => ({
            acceptedQty: line.remainingQty ?? line.qty,
            itemId: line.itemId,
            lineId: line.id,
            rejectedQty: "0",
            remarks: "",
          })) ?? [],
        purchaseOrderId: detail.id,
      });
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load purchase order.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadOrderForEdit(id: string) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      const detail = await client.purchaseOrder(id);

      setPoForm({
        currentLine: createPurchaseOrderLineForm(
          resources.items[0]?.id || "",
          itemBaseUomId(resources.items[0]) || resources.uoms[0]?.id || "",
        ),
        editingLineId: "",
        editingId: detail.id,
        expectedDate: detail.expectedDate?.slice(0, 10) || "",
        lines:
          detail.lines?.map((line) => {
            const selectedItem = resources.items.find(
              (item) => item.id === line.itemId,
            );
            const supplierItem = resources.supplierItems.find(
              (record) =>
                record.id === line.supplierItemId ||
                (record.supplierId === detail.supplierId &&
                  record.itemId === line.itemId),
            );

            return {
              costLoaded: true,
              costOverrideReason: line.costOverrideReason || "",
              defaultUnitCost: line.defaultUnitCost || "",
              itemId: line.itemId,
              lineId: line.id,
              qty: line.qty,
              supplierItemId:
                typeof supplierItem?.id === "string" ? supplierItem.id : "",
              unitCost: line.unitCost,
              uomId:
                line.uomId ||
                itemBaseUomId(selectedItem) ||
                resources.uoms[0]?.id ||
                "",
            };
          }) ?? [],
        locationId: detail.locationId,
        remarks: detail.remarks || "",
        supplierId: detail.supplierId,
      });
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load purchase order.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveReceiving(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrder) {
      return;
    }

    if (receivingForm.lines.length === 0) {
      setError("Select a purchase order with line items before receiving.");
      return;
    }

    const receivingValidationError = validateReceivingForm(
      selectedOrder,
      receivingForm,
    );

    if (receivingValidationError) {
      setError(receivingValidationError);
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();
      await client.createReceiving({
        purchaseOrderId: selectedOrder.id,
        supplierId: selectedOrder.supplierId,
        locationId: selectedOrder.locationId,
        businessDate: new Date().toISOString(),
        drReference: receivingForm.drReference.trim(),
        invoiceReference: receivingForm.invoiceReference.trim(),
        remarks: receivingForm.changeReason.trim() || undefined,
        lines: receivingForm.lines
          .filter(
            (receivingLine) =>
              Number(receivingLine.acceptedQty || 0) +
                Number(receivingLine.rejectedQty || 0) >
              0,
          )
          .map((receivingLine) => {
            const orderLine = selectedOrder.lines?.find(
              (line) => line.id === receivingLine.lineId,
            );

            return {
              itemId: receivingLine.itemId,
              acceptedQty: Number(receivingLine.acceptedQty || 0),
              rejectedQty: Number(receivingLine.rejectedQty || 0),
              remarks: receivingLine.remarks || undefined,
              unitCost: Number(orderLine?.unitCost ?? 0),
            };
          }),
      });

      await refresh(client);
      setReceivingForm(emptyReceivingForm);
      setSelectedOrder(null);
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to post receiving.",
      );
    } finally {
      setSaving(false);
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

      {showReceivingForm ? (
        <ReceivingForm
          close={() => {
            setReceivingForm(emptyReceivingForm);
            setSelectedOrder(null);
            setError(null);
          }}
          disabled={saving || loading}
          form={receivingForm}
          selectedOrder={selectedOrder}
          setForm={setReceivingForm}
          submit={saveReceiving}
        />
      ) : !isReceiving && canCreatePurchaseOrder ? (
        <PurchaseOrderForm
          disabled={saving || loading}
          form={poForm}
          resources={resources}
          setForm={setPoForm}
          submit={savePurchaseOrder}
        />
      ) : null}

      {isReceiving && !canReceiveGoods ? (
        <div className="rounded-md border border-og-line bg-white px-4 py-3 text-sm font-semibold text-og-gray">
          You can review purchase orders, but posting receiving requires the
          receiving permission.
        </div>
      ) : null}

      <PurchaseOrderTable
        canApprove={canApprovePurchaseOrder}
        canCreate={canCreatePurchaseOrder}
        canReceive={canReceiveGoods}
        edit={(order) => loadOrderForEdit(order.id)}
        filters={poFilters}
        loading={loading}
        orders={orders}
        resources={resources}
        receive={(order) => loadOrderForReceiving(order.id)}
        saving={saving}
        setFilters={setPoFilters}
        tableError={tableError}
        transition={transitionOrder}
      />
    </div>
  );
}

type PurchaseOrderFormProps = {
  disabled: boolean;
  form: PurchaseOrderForm;
  resources: ResourceState;
  setForm: (form: PurchaseOrderForm) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

function PurchaseOrderForm({
  disabled,
  form,
  resources,
  setForm,
  submit,
}: PurchaseOrderFormProps) {
  const [lineError, setLineError] = useState<string | null>(null);
  const supplierCatalog = resources.supplierItems.filter(
    (supplierItem) => supplierItem.supplierId === form.supplierId,
  );

  function updateCurrentLine(changes: Partial<PurchaseOrderLineForm>) {
    setForm({
      ...form,
      currentLine: { ...form.currentLine, ...changes },
    });
    setLineError(null);
  }

  function resetCurrentLine() {
    return createPurchaseOrderLineForm();
  }

  function addOrUpdateLine() {
    const validationError = validatePurchaseOrderLine(form.currentLine);

    if (validationError) {
      setLineError(validationError);
      return;
    }

    const nextLine = { ...form.currentLine };

    setForm({
      ...form,
      currentLine: resetCurrentLine(),
      editingLineId: "",
      lines: form.editingLineId
        ? form.lines.map((line) =>
            line.lineId === form.editingLineId ? nextLine : line,
          )
        : [...form.lines, nextLine],
    });
    setLineError(null);
  }

  function removeLine(lineId: string) {
    setForm({
      ...form,
      currentLine:
        form.editingLineId === lineId ? resetCurrentLine() : form.currentLine,
      editingLineId: form.editingLineId === lineId ? "" : form.editingLineId,
      lines: form.lines.filter((line) => line.lineId !== lineId),
    });
  }

  function editLine(line: PurchaseOrderLineForm) {
    setForm({
      ...form,
      currentLine: { ...line },
      editingLineId: line.lineId,
    });
    setLineError(null);
  }

  return (
    <form className="og-card" noValidate onSubmit={submit}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]">
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <SearchableSelectField
              label="Supplier"
              value={form.supplierId}
              options={resources.suppliers}
              optionLabel={(record) => text(record.name)}
              onChange={(supplierId) =>
                setForm({
                  ...form,
                  currentLine: {
                    ...createPurchaseOrderLineForm(),
                    costLoaded: false,
                    costOverrideReason: "",
                    defaultUnitCost: "",
                    supplierItemId: "",
                    unitCost: "",
                  },
                  editingLineId: "",
                  lines: [],
                  supplierId,
                })
              }
            />
            <SearchableSelectField
              label="Location"
              value={form.locationId}
              options={resources.locations}
              optionLabel={(record) => text(record.code)}
              onChange={(locationId) => setForm({ ...form, locationId })}
            />
            <InputField
              label="Expected"
              optional
              type="date"
              value={form.expectedDate}
              onChange={(expectedDate) => setForm({ ...form, expectedDate })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <SearchableSelectField
              label="Supplier Catalog Item"
              value={form.currentLine.supplierItemId}
              options={supplierCatalog}
              optionLabel={supplierItemLabel}
              onChange={(supplierItemId) => {
                const supplierItem = supplierCatalog.find(
                  (record) => record.id === supplierItemId,
                );
                const selectedItem = resources.items.find(
                  (item) => item.id === supplierItem?.itemId,
                );
                const purchaseUomId =
                  typeof supplierItem?.purchaseUomId === "string"
                    ? supplierItem.purchaseUomId
                    : "";
                const unitCost =
                  supplierItem?.unitCost === null ||
                  supplierItem?.unitCost === undefined
                    ? ""
                    : String(supplierItem.unitCost);

                updateCurrentLine({
                  costLoaded: false,
                  costOverrideReason: "",
                  defaultUnitCost: "",
                  itemId:
                    typeof supplierItem?.itemId === "string"
                      ? supplierItem.itemId
                      : "",
                  supplierItemId,
                  unitCost,
                  uomId: purchaseUomId || itemBaseUomId(selectedItem) || "",
                });
              }}
            />
            <InputField
              label="Qty"
              min="0.000001"
              step="0.000001"
              type="number"
              value={form.currentLine.qty}
              onChange={(qty) => updateCurrentLine({ qty })}
            />
            <SearchableSelectField
              label="UOM"
              value={form.currentLine.uomId}
              options={resources.uoms}
              optionLabel={(record) => text(record.code)}
              onChange={(uomId) => updateCurrentLine({ uomId })}
            />
            <InputField
              label="Unit Cost"
              min="0"
              step="0.000001"
              type="number"
              value={form.currentLine.unitCost}
              onChange={(unitCost) => updateCurrentLine({ unitCost })}
            />
            <div className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
              Default Cost
              <div className="flex h-10 items-center rounded-md border border-og-line bg-gray-50 px-3 text-sm font-normal text-og-gray">
                {form.currentLine.defaultUnitCost
                  ? formatCurrency(Number(form.currentLine.defaultUnitCost))
                  : "No supplier default"}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line px-4 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled}
                type="button"
                onClick={addOrUpdateLine}
              >
                <Icon name="PlusCircle" size={16} />
                {form.editingLineId ? "Update line" : "Add line"}
              </button>
              {form.editingLineId ? (
                <button
                  className="inline-flex h-10 items-center rounded-md border border-og-line px-3 text-sm font-semibold text-og-dark hover:bg-orange-50"
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      currentLine: resetCurrentLine(),
                      editingLineId: "",
                    })
                  }
                >
                  Cancel
                </button>
              ) : null}
            </div>
            {isCostOverride(form.currentLine) ? (
              <div className="md:col-span-3">
                <InputField
                  label="Override Reason"
                  type="text"
                  value={form.currentLine.costOverrideReason}
                  onChange={(costOverrideReason) =>
                    updateCurrentLine({ costOverrideReason })
                  }
                />
              </div>
            ) : null}
          </div>
          {lineError ? (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-og-error">
              {lineError}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              type="submit"
            >
              <Icon name="Save" size={16} />
              {form.editingId ? "Update PO" : "Create PO"}
            </button>
            {form.editingId ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line px-4 text-sm font-semibold text-og-dark hover:bg-orange-50"
                type="button"
                onClick={() => setForm(createPurchaseOrderForm())}
              >
                <Icon name="X" size={16} />
                Cancel
              </button>
            ) : null}
          </div>
        </section>
        <section className="min-h-[260px] rounded-md border border-og-line">
          <div className="flex items-center justify-between border-b border-og-line px-4 py-3">
            <h3 className="text-sm font-semibold text-og-dark">
              Pending Line Items
            </h3>
            <span className="text-xs font-semibold text-og-gray">
              {form.lines.length} lines
            </span>
          </div>
          <DraftLineItemsTable
            lines={form.lines}
            resources={resources}
            editLine={editLine}
            removeLine={removeLine}
          />
        </section>
      </div>
    </form>
  );
}

type DraftLineItemsTableProps = {
  editLine: (line: PurchaseOrderLineForm) => void;
  lines: PurchaseOrderLineForm[];
  removeLine: (lineId: string) => void;
  resources: ResourceState;
};

function DraftLineItemsTable({
  editLine,
  lines,
  removeLine,
  resources,
}: DraftLineItemsTableProps) {
  if (lines.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm font-semibold text-og-gray">
        No line items added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {["Catalog Item", "Qty", "UOM", "Unit Cost", "Total", "Default", ""].map(
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
            const supplierItem = resources.supplierItems.find(
              (record) => record.id === line.supplierItemId,
            );
            const uom = resources.uoms.find(
              (record) => record.id === line.uomId,
            );

            return (
              <tr
                className="cursor-pointer border-t border-og-line hover:bg-green-50"
                key={line.lineId}
                onClick={() => editLine(line)}
              >
                <td className="px-3 py-2 font-semibold text-og-dark">
                  {supplierItem ? supplierItemLabel(supplierItem) : text(item?.sku)}
                </td>
                <td className="px-3 py-2 text-og-dark">{decimal(line.qty)}</td>
                <td className="px-3 py-2 text-og-dark">{text(uom?.code)}</td>
                <td className="px-3 py-2 text-og-dark">
                  {formatCurrency(Number(line.unitCost))}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {formatCurrency(lineTotalCost(line))}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {line.defaultUnitCost
                    ? formatCurrency(Number(line.defaultUnitCost))
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="rounded-md p-1 text-og-gray hover:bg-orange-50 hover:text-og-error"
                    title="Remove line"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeLine(line.lineId);
                    }}
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

type ReceivingFormProps = {
  close: () => void;
  disabled: boolean;
  form: ReceivingForm;
  selectedOrder: PurchaseOrder | null;
  setForm: (form: ReceivingForm) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

function ReceivingForm({
  close,
  disabled,
  form,
  selectedOrder,
  setForm,
  submit,
}: ReceivingFormProps) {
  const lines = selectedOrder?.lines ?? [];
  const previousReceiving = selectedOrder?.receivings?.[0] ?? null;
  const documentReferenceChanged =
    previousReceiving !== null &&
    (normalizeReference(previousReceiving.drReference) !==
      normalizeReference(form.drReference) ||
      normalizeReference(previousReceiving.invoiceReference) !==
        normalizeReference(form.invoiceReference));

  function updateLine(lineId: string, changes: Partial<ReceivingLineForm>) {
    setForm({
      ...form,
      lines: form.lines.map((line) =>
        line.lineId === lineId ? { ...line, ...changes } : line,
      ),
    });
  }

  return (
    <form className="og-card flex flex-col gap-4" noValidate onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
          PO
          <div className="flex h-10 items-center rounded-md border border-og-line bg-gray-50 px-3 text-sm font-normal text-og-dark">
            {selectedOrder?.poNumber ?? "Select a PO from the table"}
          </div>
        </div>
        <InputField
          label="DR Ref"
          type="text"
          value={form.drReference}
          onChange={(drReference) => setForm({ ...form, drReference })}
        />
        <InputField
          label="Invoice"
          type="text"
          value={form.invoiceReference}
          onChange={(invoiceReference) =>
            setForm({ ...form, invoiceReference })
          }
        />
      </div>
      {documentReferenceChanged ? (
        <InputField
          label="Reason for DR/Invoice Change"
          type="text"
          value={form.changeReason}
          onChange={(changeReason) => setForm({ ...form, changeReason })}
        />
      ) : null}
      <div className="max-h-[360px] overflow-auto rounded-md border border-og-line">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr>
              {[
                "Item",
                "Ordered",
                "Received",
                "Rejected",
                "Remaining",
                "Accept Now",
                "Reject Now",
                "Remarks",
              ].map((column) => (
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
            {lines.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-og-gray" colSpan={8}>
                  No PO line items selected.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const formLine = form.lines.find(
                  (entry) => entry.lineId === line.id,
                );
                const remainingQty = Number(line.remainingQty ?? line.qty);

                return (
                  <tr className="border-t border-og-line" key={line.id}>
                    <td className="px-3 py-2 font-semibold text-og-dark">
                      {text(line.item?.sku)}
                    </td>
                    <td className="px-3 py-2 text-og-dark">
                      {decimal(line.qty)}
                    </td>
                    <td className="px-3 py-2 text-og-dark">
                      {decimal(line.receivedQty ?? "0")}
                    </td>
                    <td className="px-3 py-2 text-og-dark">
                      {decimal(line.rejectedQty ?? "0")}
                    </td>
                    <td className="px-3 py-2 font-semibold text-og-dark">
                      {decimal(line.remainingQty ?? line.qty)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="h-10 w-full rounded-md border border-og-line px-3 text-sm font-normal"
                        disabled={remainingQty <= 0}
                        min="0"
                        step="0.000001"
                        type="number"
                        value={formLine?.acceptedQty ?? ""}
                        onChange={(event) =>
                          updateLine(line.id, {
                            acceptedQty: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="h-10 w-full rounded-md border border-og-line px-3 text-sm font-normal"
                        disabled={remainingQty <= 0}
                        min="0"
                        step="0.000001"
                        type="number"
                        value={formLine?.rejectedQty ?? ""}
                        onChange={(event) =>
                          updateLine(line.id, {
                            rejectedQty: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="h-10 w-full rounded-md border border-og-line px-3 text-sm font-normal"
                        type="text"
                        value={formLine?.remarks ?? ""}
                        onChange={(event) =>
                          updateLine(line.id, { remarks: event.target.value })
                        }
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ReceivingHistory receivings={selectedOrder?.receivings ?? []} />
      <div className="flex items-end gap-2">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || !selectedOrder}
          type="submit"
        >
          <Icon name="PackageCheck" size={16} />
          Post Receiving
        </button>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line px-4 text-sm font-semibold text-og-dark hover:bg-orange-50"
          type="button"
          onClick={close}
        >
          <Icon name="X" size={16} />
          Close
        </button>
      </div>
    </form>
  );
}

function ReceivingHistory({ receivings }: { receivings: Receiving[] }) {
  if (receivings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-og-line">
      <div className="border-b border-og-line px-3 py-2 text-xs font-bold text-og-gray">
        Receiving History
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {["RR", "Date", "DR Ref", "Invoice", "Reason"].map((column) => (
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
            {receivings.map((receiving) => (
              <tr className="border-t border-og-line" key={receiving.id}>
                <td className="px-3 py-2 font-semibold text-og-dark">
                  {receiving.receivingNumber}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {formatDate(receiving.businessDate)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {text(receiving.drReference)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {text(receiving.invoiceReference)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {text(receiving.remarks)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type PurchaseOrderTableProps = {
  canApprove: boolean;
  canCreate: boolean;
  canReceive: boolean;
  edit: (order: PurchaseOrder) => void;
  filters: PurchaseOrderFilters;
  loading: boolean;
  orders: PurchaseOrder[];
  receive: (order: PurchaseOrder) => void;
  resources: ResourceState;
  saving: boolean;
  setFilters: (filters: PurchaseOrderFilters) => void;
  tableError: string | null;
  transition: (
    id: string,
    action: "approve" | "close" | "reject" | "submit",
  ) => void;
};

function PurchaseOrderTable({
  canApprove,
  canCreate,
  canReceive,
  edit,
  filters,
  loading,
  orders,
  receive,
  resources,
  saving,
  setFilters,
  tableError,
  transition,
}: PurchaseOrderTableProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const filteredOrders = useMemo(
    () => filterPurchaseOrders(orders, filters),
    [filters, orders],
  );

  return (
    <section className="og-card overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-og-line p-4">
        <Icon name="ClipboardList" size={20} className="text-og-green" />
        <h2 className="font-poppins text-xl font-semibold text-og-dark">
          Purchase Orders
        </h2>
      </div>
      <div className="grid gap-3 border-b border-og-line p-4 md:grid-cols-5">
        <InputField
          label="PO Search"
          optional
          type="text"
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={purchaseOrderStatuses}
          onChange={(status) => setFilters({ ...filters, status })}
        />
        <FilterSelect
          label="Supplier"
          value={filters.supplierId}
          options={resources.suppliers.map((supplier) => ({
            label: text(supplier.name),
            value: supplier.id,
          }))}
          onChange={(supplierId) => setFilters({ ...filters, supplierId })}
        />
        <FilterSelect
          label="Location"
          value={filters.locationId}
          options={resources.locations.map((location) => ({
            label: text(location.code),
            value: location.id,
          }))}
          onChange={(locationId) => setFilters({ ...filters, locationId })}
        />
        <InputField
          label="Expected"
          optional
          type="date"
          value={filters.expectedDate}
          onChange={(expectedDate) => setFilters({ ...filters, expectedDate })}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {[
                "PO",
                "Supplier",
                "Location",
                "Expected",
                "Lines",
                "Status",
              ].map((column) => (
                <th className="og-table-header" key={column}>
                  {column}
                </th>
              ))}
              <th className="og-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <StateRow colSpan={7} label="Loading purchase orders" />
            ) : null}
            {!loading && tableError ? (
              <StateRow colSpan={7} label={tableError} tone="error" />
            ) : null}
            {!loading && !tableError && filteredOrders.length === 0 ? (
              <StateRow colSpan={7} label="No purchase orders found" />
            ) : null}
            {!loading && !tableError
              ? filteredOrders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  const lineCount = order.lineCount ?? order.lines?.length ?? 0;

                  return (
                    <Fragment key={order.id}>
                      <tr className="border-t border-og-line hover:bg-[#fff5e4]">
                        <td className="og-table-cell font-semibold">
                          {order.poNumber}
                        </td>
                        <td className="og-table-cell">
                          {text(order.supplier?.name)}
                        </td>
                        <td className="og-table-cell">
                          {text(order.location?.code)}
                        </td>
                        <td className="og-table-cell">
                          {formatDate(order.expectedDate)}
                        </td>
                        <td className="og-table-cell">
                          <button
                            className="inline-flex items-center gap-1 rounded-md border border-og-line px-2 py-1 text-xs font-semibold text-og-dark hover:border-og-green hover:text-og-green"
                            type="button"
                            onClick={() =>
                              setExpandedOrderId(expanded ? null : order.id)
                            }
                          >
                            <Icon
                              name={expanded ? "ChevronUp" : "ChevronDown"}
                              size={14}
                            />
                            {lineCount}
                          </button>
                        </td>
                        <td className="og-table-cell">
                          <StatusBadge value={order.status} />
                        </td>
                        <td className="og-table-cell">
                          <div className="flex justify-end gap-1">
                            {order.status === "DRAFT" && canCreate ? (
                              <>
                                <IconButton
                                  disabled={saving}
                                  icon="Pencil"
                                  label="Edit"
                                  onClick={() => edit(order)}
                                />
                                <IconButton
                                  disabled={saving}
                                  icon="Send"
                                  label="Submit"
                                  onClick={() => transition(order.id, "submit")}
                                />
                              </>
                            ) : null}
                            {order.status === "PENDING_APPROVAL" &&
                            canApprove ? (
                              <>
                                <IconButton
                                  disabled={saving}
                                  icon="Check"
                                  label="Approve"
                                  onClick={() =>
                                    transition(order.id, "approve")
                                  }
                                />
                                <IconButton
                                  disabled={saving}
                                  icon="X"
                                  label="Reject"
                                  onClick={() => transition(order.id, "reject")}
                                />
                              </>
                            ) : null}
                            {["APPROVED", "PARTIALLY_RECEIVED"].includes(
                              order.status,
                            ) && canReceive ? (
                              <IconButton
                                disabled={saving}
                                icon="PackageCheck"
                                label="Receive"
                                onClick={() => receive(order)}
                              />
                            ) : null}
                            {order.status === "PARTIALLY_RECEIVED" &&
                            canApprove ? (
                              <IconButton
                                disabled={saving}
                                icon="LockKeyhole"
                                label="Close balance"
                                onClick={() => transition(order.id, "close")}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-og-line bg-gray-50">
                          <td className="p-0" colSpan={7}>
                            <LineItemsTable lines={order.lines ?? []} />
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

function LineItemsTable({ lines }: { lines: PurchaseOrderLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="px-6 py-4 text-sm font-semibold text-og-gray">
        No line items loaded.
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {[
              "Item",
              "Brand / Supplier SKU",
              "Ordered",
              "Received",
              "Rejected",
              "Remaining",
              "UOM",
              "Unit Cost",
              "Total",
              "Default",
              "Override",
            ].map((column) => (
              <th
                className="px-2 py-2 text-xs font-bold text-og-gray"
                key={column}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr className="border-t border-og-line" key={line.id}>
              <td className="px-2 py-2 font-semibold text-og-dark">
                {text(line.item?.sku)}
              </td>
              <td className="px-2 py-2 text-og-dark">
                {line.supplierItem ? supplierItemShortLabel(line.supplierItem) : "-"}
              </td>
              <td className="px-2 py-2 text-og-dark">{decimal(line.qty)}</td>
              <td className="px-2 py-2 text-og-dark">
                {decimal(line.receivedQty ?? "0")}
              </td>
              <td className="px-2 py-2 text-og-dark">
                {decimal(line.rejectedQty ?? "0")}
              </td>
              <td className="px-2 py-2 font-semibold text-og-dark">
                {decimal(line.remainingQty ?? line.qty)}
              </td>
              <td className="px-2 py-2 text-og-dark">{text(line.uom?.code)}</td>
              <td className="px-2 py-2 text-og-dark">
                {formatCurrency(Number(line.unitCost))}
              </td>
              <td className="px-2 py-2 text-og-dark">
                {formatCurrency(lineTotalCost(line))}
              </td>
              <td className="px-2 py-2 text-og-dark">
                {line.defaultUnitCost
                  ? formatCurrency(Number(line.defaultUnitCost))
                  : "-"}
              </td>
              <td className="px-2 py-2 text-og-dark">
                {line.costOverrideReason || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  options: MasterDataRecord[];
  optionLabel: (record: MasterDataRecord) => string;
  onChange: (value: string) => void;
};

function SearchableSelectField(props: SelectFieldProps) {
  const { label, value, options, optionLabel, onChange } = props;
  const inputId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedOption = options.find((option) => option.id === value);
  const selectedLabel = selectedOption ? optionLabel(selectedOption) : "";
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((option) =>
        optionLabel(option).toLowerCase().includes(normalizedSearch),
      )
    : options;

  useEffect(() => {
    if (!open) {
      setSearch(selectedLabel);
    }
  }, [open, selectedLabel]);

  function selectOption(option: MasterDataRecord) {
    onChange(option.id);
    setSearch(optionLabel(option));
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
        placeholder="Search"
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
                className={`block w-full px-3 py-2 text-left text-sm font-normal hover:bg-green-50 ${
                  option.id === value ? "text-og-green" : "text-og-dark"
                }`}
                aria-selected={option.id === value}
                key={option.id}
                role="option"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
              >
                {optionLabel(option)}
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

function SelectField({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
      {label}
      <select
        className="h-10 rounded-md border border-og-line bg-white px-3 text-sm font-normal"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

type FilterSelectProps = {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
};

function FilterSelect({ label, options, value, onChange }: FilterSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
      {label}
      <select
        className="h-10 rounded-md border border-og-line bg-white px-3 text-sm font-normal"
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

type InputFieldProps = {
  label: string;
  min?: string;
  optional?: boolean;
  step?: string;
  type: "date" | "number" | "text";
  value: string;
  onChange: (value: string) => void;
};

function InputField({
  label,
  min,
  optional = false,
  step,
  type,
  value,
  onChange,
}: InputFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
      {label}
      <input
        className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
        min={min}
        required={!optional && type !== "text"}
        step={step}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

type IconButtonProps = {
  disabled: boolean;
  icon: "Check" | "LockKeyhole" | "PackageCheck" | "Pencil" | "Send" | "X";
  label: string;
  onClick: () => void;
};

function IconButton({ disabled, icon, label, onClick }: IconButtonProps) {
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

function StateRow({
  colSpan,
  label,
  tone = "muted",
}: {
  colSpan: number;
  label: string;
  tone?: "error" | "muted";
}) {
  return (
    <tr className="border-t border-og-line">
      <td
        className={`og-table-cell py-8 text-center ${
          tone === "error" ? "font-semibold text-og-error" : "text-og-gray"
        }`}
        colSpan={colSpan}
      >
        {label}
      </td>
    </tr>
  );
}

function validatePurchaseOrderForm(form: PurchaseOrderForm) {
  if (!form.supplierId || !form.locationId) {
    return "Select a supplier and location before creating a PO.";
  }

  if (form.lines.length === 0) {
    return "Add at least one line item before creating a PO.";
  }

  for (const [index, line] of form.lines.entries()) {
    const lineNumber = index + 1;

    if (!line.supplierItemId || !line.itemId || !line.uomId) {
      return `Select a supplier catalog item and UOM for line ${lineNumber}.`;
    }

    if (!isPositiveNumber(line.qty)) {
      return `Enter a quantity greater than zero for line ${lineNumber}.`;
    }

    if (line.unitCost === "" || Number.isNaN(Number(line.unitCost))) {
      return `Enter a valid unit cost for line ${lineNumber}.`;
    }

    if (Number(line.unitCost) < 0) {
      return `Unit cost cannot be negative on line ${lineNumber}.`;
    }

    if (isCostOverride(line) && !line.costOverrideReason.trim()) {
      return `Enter a reason for overriding the supplier default cost on line ${lineNumber}.`;
    }
  }

  return null;
}

function validatePurchaseOrderLine(line: PurchaseOrderLineForm) {
  if (!line.supplierItemId || !line.itemId || !line.uomId) {
    return "Select a supplier catalog item and UOM before adding the line.";
  }

  if (!isPositiveNumber(line.qty)) {
    return "Enter a quantity greater than zero before adding the line.";
  }

  if (line.unitCost === "" || Number.isNaN(Number(line.unitCost))) {
    return "Enter a valid unit cost before adding the line.";
  }

  if (Number(line.unitCost) < 0) {
    return "Unit cost cannot be negative.";
  }

  if (isCostOverride(line) && !line.costOverrideReason.trim()) {
    return "Enter a reason for overriding the supplier default cost.";
  }

  return null;
}

function validateReceivingForm(
  selectedOrder: PurchaseOrder,
  form: ReceivingForm,
) {
  let hasQuantity = false;
  const previousReceiving = selectedOrder.receivings?.[0] ?? null;
  const documentReferenceChanged =
    previousReceiving !== null &&
    (normalizeReference(previousReceiving.drReference) !==
      normalizeReference(form.drReference) ||
      normalizeReference(previousReceiving.invoiceReference) !==
        normalizeReference(form.invoiceReference));

  if (!form.drReference.trim()) {
    return "DR Ref is required before posting receiving.";
  }

  if (!form.invoiceReference.trim()) {
    return "Invoice is required before posting receiving.";
  }

  if (documentReferenceChanged && !form.changeReason.trim()) {
    return "Enter a reason when DR Ref or Invoice differs from the previous receiving.";
  }

  for (const orderLine of selectedOrder.lines ?? []) {
    const receivingLine = form.lines.find(
      (line) => line.lineId === orderLine.id,
    );

    if (!receivingLine) {
      return `Receiving line is missing for ${text(orderLine.item?.sku)}.`;
    }

    const remainingQty = Number(orderLine.remainingQty ?? orderLine.qty);
    const acceptedQty = Number(receivingLine.acceptedQty || 0);
    const rejectedQty = Number(receivingLine.rejectedQty || 0);

    if (!Number.isFinite(acceptedQty) || acceptedQty < 0) {
      return `Accepted qty for ${text(orderLine.item?.sku)} must be zero or greater.`;
    }

    if (!Number.isFinite(rejectedQty) || rejectedQty < 0) {
      return `Rejected qty for ${text(orderLine.item?.sku)} must be zero or greater.`;
    }

    if (acceptedQty + rejectedQty > remainingQty) {
      return `Accepted plus rejected cannot exceed remaining qty for ${text(orderLine.item?.sku)}.`;
    }

    if (acceptedQty + rejectedQty > 0) {
      hasQuantity = true;
    }
  }

  if (!hasQuantity) {
    return "Enter accepted or rejected quantity before posting receiving.";
  }

  return null;
}

function filterPurchaseOrders(
  orders: PurchaseOrder[],
  filters: PurchaseOrderFilters,
) {
  const search = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (search && !order.poNumber.toLowerCase().includes(search)) {
      return false;
    }

    if (filters.status && order.status !== filters.status) {
      return false;
    }

    if (filters.supplierId && order.supplierId !== filters.supplierId) {
      return false;
    }

    if (filters.locationId && order.locationId !== filters.locationId) {
      return false;
    }

    if (
      filters.expectedDate &&
      order.expectedDate?.slice(0, 10) !== filters.expectedDate
    ) {
      return false;
    }

    return true;
  });
}

function isPositiveNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}

function isCostOverride(line: PurchaseOrderLineForm) {
  const unitCost = Number(line.unitCost);

  if (!Number.isFinite(unitCost) || line.unitCost === "") {
    return false;
  }

  if (!line.defaultUnitCost) {
    return true;
  }

  return unitCost !== Number(line.defaultUnitCost);
}

function countStatus(orders: PurchaseOrder[], status: string) {
  return String(orders.filter((order) => order.status === status).length);
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function lineTotalCost(line: { qty: string; unitCost: string }) {
  const qty = Number(line.qty);
  const unitCost = Number(line.unitCost);

  if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) {
    return 0;
  }

  return qty * unitCost;
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return Number(value).toLocaleString("en-PH", { maximumFractionDigits: 6 });
}

function normalizeReference(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function supplierItemLabel(record: MasterDataRecord) {
  const item = isRecord(record.item) ? record.item : null;
  const parts = [
    text(item?.sku),
    text(item?.name),
    text(record.brand),
    text(record.supplierSku),
    text(record.packSize),
    record.unitCost === null || record.unitCost === undefined
      ? ""
      : formatCurrency(Number(record.unitCost)),
  ].filter((part) => part && part !== "-");

  return parts.join(" | ");
}

function supplierItemShortLabel(record: MasterDataRecord) {
  const parts = [
    text(record.brand),
    text(record.supplierSku),
    text(record.packSize),
  ].filter((part) => part && part !== "-");

  return parts.length > 0 ? parts.join(" | ") : "-";
}

function itemBaseUomId(item: MasterDataRecord | undefined) {
  if (!item) {
    return "";
  }

  if (typeof item.baseUomId === "string") {
    return item.baseUomId;
  }

  if (isRecord(item.baseUom) && typeof item.baseUom.id === "string") {
    return item.baseUom.id;
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
