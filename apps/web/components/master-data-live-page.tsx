"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import type { IconName } from "@/lib/icons";
import type { Screen } from "@/lib/screens";
import {
  ApiClient,
  TOKEN_KEY,
  type AuthenticatedUser,
  type MasterDataImportResult,
  type MasterDataRecord,
  type MasterDataResource,
} from "@/lib/api-client";

type MasterDataLivePageProps = {
  initialResource?: MasterDataResource;
  lockedResource?: boolean;
  screen: Screen;
};

type FieldType = "checkbox" | "email" | "number" | "select" | "text";

type Field = {
  helper?: string;
  key: string;
  label: string;
  optional?: boolean;
  readOnly?: boolean;
  ref?: MasterDataResource;
  type: FieldType;
  options?: Array<{ label: string; value: string }>;
};

type ResourceConfig = {
  resource: MasterDataResource;
  label: string;
  icon: IconName;
  columns: string[];
  fields: Field[];
  toRows: (records: MasterDataRecord[]) => string[][];
};

type ResourceState = Partial<Record<MasterDataResource, MasterDataRecord[]>>;
type FieldErrors = Record<string, string>;
type FilterState = Record<string, string>;
type FilterField = {
  allLabel: string;
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
};
type RecipeLineForm = {
  ingredientId: string;
  qty: string;
  uomId: string;
};
type YieldObservationForm = {
  actualOutputQty: string;
  expectedOutputQty: string;
  notes: string;
};

const itemTypeOptions = [
  "RAW_MATERIAL",
  "PACKAGING",
  "SUPPLY",
  "FINISHED_GOOD",
  "SEMI_FINISHED",
].map(toOption);

const locationTypeOptions = ["WAREHOUSE", "BRANCH"].map(toOption);

const reasonCodeTypeOptions = [
  "WASTAGE",
  "ADJUSTMENT",
  "VARIANCE",
  "CANCELLATION",
].map(toOption);

const configs: ResourceConfig[] = [
  {
    resource: "items",
    label: "Items",
    icon: "Package",
    columns: ["SKU", "Name", "Type", "Category", "Base UOM", "Loose", "Status"],
    fields: [
      { key: "sku", label: "SKU", type: "text" },
      { key: "name", label: "Name", type: "text" },
      {
        key: "itemType",
        label: "Item type",
        options: itemTypeOptions,
        type: "select",
      },
      {
        key: "categoryId",
        label: "Category",
        optional: true,
        ref: "categories",
        type: "select",
      },
      { key: "baseUomId", label: "Base UOM", ref: "uoms", type: "select" },
      {
        key: "lowStockThreshold",
        label: "Low stock threshold",
        optional: true,
        type: "number",
      },
      {
        key: "looseCountEnabled",
        label: "Loose count item",
        optional: true,
        type: "checkbox",
      },
      {
        key: "looseWholeUomId",
        label: "Whole unit UOM",
        optional: true,
        ref: "uoms",
        type: "select",
      },
      {
        key: "looseWholeUnitQty",
        label: "Base qty per whole unit",
        optional: true,
        type: "number",
      },
      {
        key: "looseRemainderUomId",
        label: "Loose count UOM",
        optional: true,
        ref: "uoms",
        type: "select",
      },
    ],
    toRows: (records) =>
      records.map((record) => [
        text(record.sku),
        text(record.name),
        text(record.itemType),
        relatedName(record.category),
        relatedCode(record.baseUom),
        looseItemLabel(record),
        status(record.active),
      ]),
  },
  {
    resource: "uoms",
    label: "UOMs",
    icon: "Ruler",
    columns: ["Code", "Name", "Status"],
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text" },
    ],
    toRows: (records) =>
      records.map((record) => [
        text(record.code),
        text(record.name),
        status(record.active),
      ]),
  },
  {
    resource: "uom-conversions",
    label: "Conversions",
    icon: "Repeat",
    columns: ["From", "To", "Factor"],
    fields: [
      { key: "fromUomId", label: "From UOM", ref: "uoms", type: "select" },
      { key: "toUomId", label: "To UOM", ref: "uoms", type: "select" },
      {
        key: "conversionPerUnit",
        label: "Conversion per 1 From UOM",
        type: "number",
      },
      {
        key: "factor",
        label: "Factor",
        optional: true,
        readOnly: true,
        type: "number",
      },
    ],
    toRows: (records) =>
      records.map((record) => [
        relatedCode(record.fromUom),
        relatedCode(record.toUom),
        decimal(record.factor),
      ]),
  },
  {
    resource: "suppliers",
    label: "Suppliers",
    icon: "Handshake",
    columns: ["Name", "Contact", "Email", "Phone", "Status"],
    fields: [
      { key: "name", label: "Name", type: "text" },
      {
        key: "contactName",
        label: "Contact name",
        optional: true,
        type: "text",
      },
      { key: "email", label: "Email", optional: true, type: "email" },
      { key: "phone", label: "Phone", optional: true, type: "text" },
      {
        key: "paymentTerms",
        label: "Payment terms",
        optional: true,
        type: "text",
      },
    ],
    toRows: (records) =>
      records.map((record) => [
        text(record.name),
        text(record.contactName),
        text(record.email),
        text(record.phone),
        status(record.active),
      ]),
  },
  {
    resource: "supplier-items",
    label: "Supplier Items",
    icon: "PackageCheck",
    columns: [
      "Supplier",
      "Internal Item",
      "Brand",
      "Supplier SKU",
      "Pack",
      "Purchase UOM",
      "Purchase UOM to Base",
      "Cost",
      "Status",
    ],
    fields: [
      {
        key: "supplierId",
        label: "Supplier",
        ref: "suppliers",
        type: "select",
      },
      { key: "itemId", label: "Internal item", ref: "items", type: "select" },
      { key: "brand", label: "Brand", optional: true, type: "text" },
      {
        key: "supplierSku",
        label: "Supplier SKU",
        optional: true,
        type: "text",
      },
      { key: "packSize", label: "Pack size", optional: true, type: "text" },
      {
        key: "purchaseUomId",
        label: "Purchase UOM",
        optional: true,
        ref: "uoms",
        type: "select",
      },
      {
        key: "conversionToBase",
        helper: "How many base units are inside 1 purchase UOM.",
        label: "Base Qty",
        optional: true,
        type: "number",
      },
      {
        key: "baseUomDisplay",
        label: "Base UOM",
        optional: true,
        readOnly: true,
        type: "text",
      },
      {
        key: "unitCost",
        label: "Default unit cost",
        optional: true,
        type: "number",
      },
    ],
    toRows: (records) =>
      records.map((record) => [
        relatedName(record.supplier),
        relatedCode(record.item),
        text(record.brand),
        text(record.supplierSku),
        text(record.packSize),
        relatedCode(record.purchaseUom),
        supplierItemConversionLabel(record),
        record.unitCost === null || record.unitCost === undefined
          ? "-"
          : formatCurrency(Number(record.unitCost)),
        status(record.active),
      ]),
  },
  {
    resource: "locations",
    label: "Locations",
    icon: "MapPin",
    columns: ["Code", "Name", "Type", "Status"],
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text" },
      {
        key: "type",
        label: "Type",
        options: locationTypeOptions,
        type: "select",
      },
    ],
    toRows: (records) =>
      records.map((record) => [
        text(record.code),
        text(record.name),
        text(record.type),
        status(record.active),
      ]),
  },
  {
    resource: "categories",
    label: "Categories",
    icon: "Tags",
    columns: ["Name", "Status"],
    fields: [{ key: "name", label: "Name", type: "text" }],
    toRows: (records) =>
      records.map((record) => [text(record.name), status(record.active)]),
  },
  {
    resource: "reason-codes",
    label: "Reason Codes",
    icon: "ListChecks",
    columns: ["Code", "Name", "Type", "Status"],
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text" },
      {
        key: "type",
        label: "Type",
        options: reasonCodeTypeOptions,
        type: "select",
      },
    ],
    toRows: (records) =>
      records.map((record) => [
        text(record.code),
        text(record.name),
        text(record.type),
        status(record.active),
      ]),
  },
  {
    resource: "recipes",
    label: "Recipes",
    icon: "ChefHat",
    columns: [
      "Output Item",
      "Version",
      "Serving Qty",
      "Yield",
      "Total Cost",
      "Cost / Serving",
      "Lines",
      "Status",
    ],
    fields: [
      {
        key: "outputItemId",
        label: "Output item",
        ref: "items",
        type: "select",
      },
      { key: "version", label: "Version", optional: true, type: "number" },
      { key: "servingQty", label: "Serving qty", type: "number" },
      {
        key: "yieldPercent",
        label: "Yield percent",
        optional: true,
        type: "number",
      },
      {
        key: "yieldOverrideReason",
        label: "Yield override reason",
        optional: true,
        type: "text",
      },
      {
        key: "wastageFactor",
        label: "Wastage factor",
        optional: true,
        type: "number",
      },
      {
        key: "wastageOverrideReason",
        label: "Wastage override reason",
        optional: true,
        type: "text",
      },
    ],
    toRows: (records) =>
      records.map((record) => [
        relatedName(record.outputItem),
        `v${text(record.version)}`,
        decimal(record.servingQty),
        `${decimal(record.yieldPercent)}%`,
        formatCurrency(Number(record.totalRecipeCost ?? 0)),
        formatCurrency(Number(record.costPerServing ?? 0)),
        String(Array.isArray(record.lines) ? record.lines.length : 0),
        status(record.active),
      ]),
  },
];

const emptyRecords: MasterDataRecord[] = [];
const blankRecipeLine: RecipeLineForm = {
  ingredientId: "",
  qty: "",
  uomId: "",
};
const blankYieldObservation: YieldObservationForm = {
  actualOutputQty: "",
  expectedOutputQty: "",
  notes: "",
};

export function MasterDataLivePage({
  initialResource,
  lockedResource = false,
  screen,
}: MasterDataLivePageProps) {
  const [activeResource, setActiveResource] = useState<MasterDataResource>(
    initialResource ?? "items",
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] =
    useState<MasterDataImportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipeLines, setRecipeLines] = useState<RecipeLineForm[]>([
    blankRecipeLine,
  ]);
  const [records, setRecords] = useState<ResourceState>({});
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [yieldObservation, setYieldObservation] =
    useState<YieldObservationForm>(blankYieldObservation);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeConfig =
    configs.find((config) => config.resource === activeResource) ?? configs[0];
  const activeRecords = records[activeResource] ?? emptyRecords;
  const visibleRecords = useMemo(
    () => applyFilters(activeConfig, activeRecords, filters),
    [activeConfig, activeRecords, filters],
  );
  const selectedRecord =
    activeRecords.find((record) => record.id === selectedId) ?? null;
  const rows = useMemo(
    () => activeConfig.toRows(visibleRecords),
    [activeConfig, visibleRecords],
  );
  const canCreateActiveResource = canCreateResource(activeResource, user);
  const canDownloadTemplate = canDownloadMasterDataTemplate(user);
  const canImportTemplate = canImportMasterDataTemplate(user);
  const visibleConfigs = useMemo(() => {
    const readableConfigs = configs.filter((config) =>
      canReadResource(config.resource, user),
    );

    return lockedResource && initialResource
      ? readableConfigs.filter((config) => config.resource === initialResource)
      : readableConfigs;
  }, [initialResource, lockedResource, user]);

  useEffect(() => {
    if (initialResource) {
      setActiveResource(initialResource);
    }
  }, [initialResource]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = window.localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setTableError("Sign in again to load master data.");
        setLoading(false);
        return;
      }

      try {
        const client = new ApiClient(token);
        const currentUser = await client.currentUser();
        const readableResources = configs
          .map((config) => config.resource)
          .filter((resource) => canReadResource(resource, currentUser));
        const requestedResource = initialResource ?? "items";
        const nextActiveResource = readableResources.includes(requestedResource)
          ? requestedResource
          : readableResources[0];
        const resourcesToLoad =
          lockedResource && initialResource !== nextActiveResource
            ? []
            : resourcesNeededFor(nextActiveResource, currentUser);
        const responses = await Promise.all(
          resourcesToLoad.map(
            async (resource) =>
              [resource, await client.masterData(resource)] as const,
          ),
        );

        if (!cancelled) {
          setUser(currentUser);
          setRecords(
            Object.fromEntries(
              responses.map(([resource, response]) => [
                resource,
                response.data,
              ]),
            ),
          );
          if (resourcesToLoad.length === 0) {
            setTableError("Insufficient permissions.");
          } else {
            setActiveResource(nextActiveResource);
            setTableError(null);
          }
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTableError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load master data.",
          );
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [initialResource, lockedResource]);

  useEffect(() => {
    setForm(blankForm(activeConfig, records));
    setRecipeLines([blankRecipeLine]);
    setSelectedId(null);
  }, [activeConfig, records]);

  async function selectResource(resource: MasterDataResource) {
    if (!canReadResource(resource, user)) {
      setTableError("Insufficient permissions.");
      return;
    }

    setActiveResource(resource);
    setFilters({});
    setFieldErrors({});
    setFormError(null);
    setTableError(null);

    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setTableError("Sign in again to load master data.");
      return;
    }

    const resourcesToLoad = resourcesNeededFor(resource, user).filter(
      (nextResource) => !records[nextResource],
    );

    if (resourcesToLoad.length === 0) {
      return;
    }

    setLoading(true);

    try {
      const client = new ApiClient(token);
      const responses = await Promise.all(
        resourcesToLoad.map(
          async (nextResource) =>
            [nextResource, await client.masterData(nextResource)] as const,
        ),
      );

      setRecords((current) => ({
        ...current,
        ...Object.fromEntries(
          responses.map(([nextResource, response]) => [
            nextResource,
            response.data,
          ]),
        ),
      }));
    } catch (error) {
      setTableError(
        error instanceof Error ? error.message : "Unable to load master data.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key: string, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters({});
  }

  async function downloadTemplate() {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setTableError("Sign in again to download the template.");
      return;
    }

    setTableError(null);

    try {
      const client = new ApiClient(token);
      const blob = await client.downloadMasterDataTemplate();
      downloadBlob(blob, "OGFI_Master_Data_Template.xlsx");
    } catch (error) {
      setTableError(
        error instanceof Error ? error.message : "Unable to download template.",
      );
    }
  }

  async function uploadTemplate(file: File | undefined) {
    if (!file) {
      return;
    }

    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setTableError("Sign in again to upload the template.");
      return;
    }

    setImporting(true);
    setImportResult(null);
    setTableError(null);

    try {
      const client = new ApiClient(token);
      const result = await client.importMasterDataTemplate(file);
      const resourcesToLoad = configs
        .map((config) => config.resource)
        .filter((resource) => canReadResource(resource, user));
      const responses = await Promise.all(
        resourcesToLoad.map(
          async (resource) =>
            [resource, await client.masterData(resource)] as const,
        ),
      );
      const nextRecords = {
        ...records,
        ...Object.fromEntries(
          responses.map(([resource, response]) => [resource, response.data]),
        ),
      };

      setRecords(nextRecords);
      setImportResult(result);
      setSelectedId(null);
      setForm(blankForm(activeConfig, nextRecords));
      setRecipeLines([{ ...blankRecipeLine }]);
      setYieldObservation(blankYieldObservation);
    } catch (error) {
      setTableError(
        error instanceof Error ? error.message : "Unable to upload template.",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function downloadErrorReport() {
    if (!importResult?.errorReportBase64) {
      return;
    }

    downloadBase64File(
      importResult.errorReportBase64,
      importResult.errorReportFilename ?? "OGFI_Master_Data_Import_Errors.xlsx",
    );
  }

  function selectRecord(record: MasterDataRecord) {
    if (record.id === selectedId) {
      clearSelection();
      return;
    }

    setSelectedId(record.id);
    setForm(formFromRecord(activeConfig, record));
    setRecipeLines(recipeLinesFromRecord(record));
    setYieldObservation({
      ...blankYieldObservation,
      expectedOutputQty: decimal(record.servingQty),
    });
    setFieldErrors({});
    setFormError(null);
  }

  function clearSelection() {
    setSelectedId(null);
    setForm(blankForm(activeConfig, records));
    setRecipeLines([{ ...blankRecipeLine }]);
    setYieldObservation(blankYieldObservation);
    setFieldErrors({});
    setFormError(null);
  }

  function updateField(key: string, value: string) {
    setForm((current) => {
      if (activeResource === "uom-conversions" && key === "conversionPerUnit") {
        return { ...current, conversionPerUnit: value, factor: value };
      }

      return { ...current, [key]: value };
    });
    setFieldErrors((current) => {
      const rest = { ...current };
      delete rest[key];
      if (key === "conversionPerUnit") {
        delete rest.factor;
      }
      return rest;
    });
    setFormError(null);
  }

  function updateRecipeLine(
    index: number,
    key: keyof RecipeLineForm,
    value: string,
  ) {
    setRecipeLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
    setFieldErrors((current) => {
      const rest = { ...current };
      delete rest[`lines.${index}.${key}`];
      return rest;
    });
    setFormError(null);
  }

  function addRecipeLine() {
    setRecipeLines((current) => [...current, { ...blankRecipeLine }]);
  }

  function removeRecipeLine(index: number) {
    setRecipeLines((current) =>
      current.length === 1
        ? [{ ...blankRecipeLine }]
        : current.filter((_, lineIndex) => lineIndex !== index),
    );
    setFieldErrors({});
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate("save");
  }

  async function deactivateSelected() {
    if (!selectedId) {
      return;
    }

    await mutate("deactivate");
  }

  async function mutate(action: "deactivate" | "save") {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setFormError("Sign in again before saving.");
      return;
    }

    const validationErrors =
      action === "save" ? validateForm(activeConfig, form, recipeLines) : {};

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError("Review the highlighted fields.");
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const client = new ApiClient(token);

      if (action === "deactivate" && selectedId) {
        await client.deactivateMasterData(activeResource, selectedId);
      } else {
        if (!selectedId && !canCreateResource(activeResource, user)) {
          setSaving(false);
          setFormError("You do not have permission to create this record.");
          return;
        }

        const payload = payloadFromForm(activeConfig, form, recipeLines);

        if (selectedId) {
          await client.updateMasterData(activeResource, selectedId, payload);
        } else {
          await client.createMasterData(activeResource, payload);
        }
      }

      const response = await client.masterData(activeResource);
      setRecords((current) => ({
        ...current,
        [activeResource]: response.data,
      }));
      setFieldErrors({});
      setFormError(null);
      setSelectedId(null);
      setForm(blankForm(activeConfig, records));
      setRecipeLines([{ ...blankRecipeLine }]);
      setYieldObservation(blankYieldObservation);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save master data.";
      setFieldErrors(toFieldErrors(activeConfig, message));
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function submitYieldObservation() {
    if (!selectedId || activeConfig.resource !== "recipes") {
      return;
    }

    const expected = Number(yieldObservation.expectedOutputQty);
    const actual = Number(yieldObservation.actualOutputQty);

    if (!Number.isFinite(expected) || expected <= 0) {
      setFormError("Expected output qty must be greater than zero.");
      return;
    }

    if (!Number.isFinite(actual) || actual <= 0) {
      setFormError("Actual usable output qty must be greater than zero.");
      return;
    }

    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setFormError("Sign in again before recording observed yield.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const client = new ApiClient(token);
      await client.recordRecipeYieldObservation(selectedId, {
        actualOutputQty: actual,
        expectedOutputQty: expected,
        notes: emptyToUndefined(yieldObservation.notes),
      });
      const response = await client.masterData(activeResource);
      setRecords((current) => ({
        ...current,
        [activeResource]: response.data,
      }));
      setSelectedId(null);
      setForm(blankForm(activeConfig, records));
      setRecipeLines([{ ...blankRecipeLine }]);
      setYieldObservation(blankYieldObservation);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to record yield.",
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
        <div className="flex flex-wrap gap-2 md:justify-end">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark transition hover:border-og-green disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canDownloadTemplate || importing}
            onClick={() => void downloadTemplate()}
            title={
              canDownloadTemplate
                ? "Download master data import template"
                : "Requires read access to all master data sections"
            }
            type="button"
          >
            <Icon name="Download" size={16} />
            Template
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-3 text-sm font-semibold text-white transition hover:bg-og-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canImportTemplate || importing}
            onClick={() => fileInputRef.current?.click()}
            title={
              canImportTemplate
                ? "Upload completed master data workbook"
                : "Requires create and update access to all master data sections"
            }
            type="button"
          >
            <Icon name={importing ? "RefreshCw" : "Upload"} size={16} />
            {importing ? "Uploading" : "Upload"}
          </button>
          <input
            accept=".xlsx"
            className="hidden"
            onChange={(event) => void uploadTemplate(event.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {visibleConfigs.map((config) => (
          <button
            className={`flex h-16 items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold transition ${
              config.resource === activeResource
                ? "border-og-green bg-green-50 text-og-green"
                : "border-og-line bg-white text-og-dark hover:border-og-green"
            }`}
            key={config.resource}
            onClick={() => {
              if (!lockedResource) {
                selectResource(config.resource);
              }
            }}
            type="button"
          >
            <Icon name={config.icon} size={18} />
            <span className="leading-4">{config.label}</span>
          </button>
          ))}
      </section>

      {importResult ? (
        <section className="rounded-md border border-og-line bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-og-dark">
                Import finished: {importResult.imported} imported,{" "}
                {importResult.created} created, {importResult.updated} updated,{" "}
                {importResult.failed} failed
              </p>
              {importResult.failed > 0 ? (
                <p className="mt-1 text-sm text-og-gray">
                  Fix the downloadable error workbook, then upload it again.
                </p>
              ) : (
                <p className="mt-1 text-sm text-og-gray">
                  All rows in the workbook were accepted.
                </p>
              )}
            </div>
            {importResult.errorReportBase64 ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark transition hover:border-og-green"
                onClick={downloadErrorReport}
                type="button"
              >
                <Icon name="FileSpreadsheet" size={16} />
                Error Report
              </button>
            ) : null}
          </div>
          {importResult.errors.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-og-gray">
              {importResult.errors.slice(0, 3).map((error) => (
                <li key={`${error.sheet}-${error.row}`}>
                  <span className="font-semibold text-og-dark">
                    {error.sheet} row {error.row}:
                  </span>{" "}
                  {error.errors.join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section
        className={`grid gap-4 ${
          activeConfig.resource === "recipes"
            ? "xl:grid-cols-[minmax(0,1fr)_minmax(520px,600px)]"
            : "xl:grid-cols-[minmax(0,1fr)_380px]"
        }`}
      >
        <div className="og-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-og-line p-4">
            <div className="flex items-center gap-2">
              <Icon
                name={activeConfig.icon}
                size={20}
                className="text-og-green"
              />
              <h2 className="font-poppins text-xl font-semibold text-og-dark">
                {activeConfig.label}
              </h2>
            </div>
            <span className="text-xs font-semibold text-og-gray">
              {visibleRecords.length}
              {visibleRecords.length === activeRecords.length
                ? ""
                : ` of ${activeRecords.length}`}{" "}
              records
            </span>
          </div>

          <FilterControls
            config={activeConfig}
            filters={filters}
            onChange={updateFilter}
            onClear={clearFilters}
            records={records}
          />

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {activeConfig.columns.map((column) => (
                    <th className="og-table-header" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <StateRow
                    columns={activeConfig.columns.length}
                    label="Loading master data"
                  />
                ) : null}

                {!loading && tableError ? (
                  <StateRow
                    columns={activeConfig.columns.length}
                    label={tableError}
                    tone="error"
                  />
                ) : null}

                {!loading && !tableError && rows.length === 0 ? (
                  <StateRow
                    columns={activeConfig.columns.length}
                    label="No master data records found"
                  />
                ) : null}

                {!loading && !tableError
                  ? rows.map((row, index) => {
                      const record = visibleRecords[index];
                      const selected = record.id === selectedId;

                      return (
                        <tr
                          className={`cursor-pointer border-t border-og-line ${
                            selected ? "bg-green-50" : "hover:bg-[#fff5e4]"
                          }`}
                          key={record.id}
                          onClick={() => selectRecord(record)}
                        >
                          {row.map((cell, cellIndex) => (
                            <td
                              className="og-table-cell"
                              key={`${record.id}-${cellIndex}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>
        </div>

        <form className="og-card flex flex-col gap-3" onSubmit={submit}>
          <div className="flex items-center justify-between">
            <h2 className="font-poppins text-lg font-semibold text-og-dark">
              {selectedRecord ? "Update Record" : "Create Record"}
            </h2>
            {selectedRecord ? (
              <button
                className="rounded-md p-2 text-og-gray hover:bg-orange-50 hover:text-og-dark"
                onClick={() => {
                  clearSelection();
                }}
                type="button"
              >
                <Icon name="X" size={18} />
              </button>
            ) : null}
          </div>

          {activeConfig.fields.map((field) => (
            <label
              className="flex flex-col gap-1 text-xs font-semibold text-og-gray"
              key={field.key}
            >
              {field.label}
              {field.type === "checkbox" ? (
                <span className="flex h-10 items-center gap-2 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark">
                  <input
                    checked={form[field.key] === "true"}
                    className="h-4 w-4 accent-og-green"
                    type="checkbox"
                    onChange={(event) =>
                      updateField(field.key, String(event.target.checked))
                    }
                  />
                  Enabled
                </span>
              ) : field.type === "select" ? (
                <select
                  className={`h-10 rounded-md border bg-white px-3 text-sm font-medium text-og-dark ${
                    fieldErrors[field.key]
                      ? "border-og-error"
                      : "border-og-line"
                  }`}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                  required={!field.optional}
                  value={form[field.key] ?? ""}
                >
                  {field.optional ? <option value="">None</option> : null}
                  {optionsFor(field, records).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    className={`h-10 rounded-md border px-3 text-sm font-medium text-og-dark ${
                      fieldErrors[field.key]
                        ? "border-og-error"
                        : "border-og-line"
                    } ${field.readOnly ? "bg-gray-50 text-og-gray" : ""}`}
                    onBlur={() => {
                      if (usesTwoDecimalInput(activeConfig, field)) {
                        updateField(
                          field.key,
                          decimalForInput(form[field.key], 2),
                        );
                      }
                    }}
                    onChange={(event) =>
                      updateField(field.key, event.target.value)
                    }
                    readOnly={field.readOnly}
                    required={!field.optional}
                    step={
                      field.type === "number"
                        ? usesTwoDecimalInput(activeConfig, field)
                          ? "0.01"
                          : "0.000001"
                        : undefined
                    }
                    type={field.type}
                    value={
                      supplierItemBaseUomValue(
                        activeConfig,
                        field,
                        form,
                        records,
                      ) ??
                      form[field.key] ??
                      ""
                    }
                  />
                  {field.helper ? (
                    <span className="text-[11px] font-normal leading-4 text-og-gray">
                      {field.helper}
                    </span>
                  ) : null}
                  {supplierItemConversionHint(activeConfig, field, form, records) ? (
                    <span className="text-[11px] font-normal leading-4 text-og-gray">
                      {supplierItemConversionHint(activeConfig, field, form, records)}
                    </span>
                  ) : null}
                </>
              )}
              {fieldErrors[field.key] ? (
                <span className="inline-flex items-start gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold leading-4 text-og-error">
                  <Icon name="TriangleAlert" size={14} />
                  {fieldErrors[field.key]}
                </span>
              ) : null}
            </label>
          ))}

          {activeConfig.resource === "recipes" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-normal text-og-gray">
                  Ingredients
                </p>
                <button
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-og-line bg-white px-2 text-xs font-semibold text-og-dark hover:border-og-green hover:text-og-green"
                  onClick={addRecipeLine}
                  type="button"
                >
                  <Icon name="PlusCircle" size={14} />
                  Add
                </button>
              </div>

              <div className="rounded-md border border-og-line">
                <div className="hidden grid-cols-[minmax(0,1fr)_96px_96px_40px] gap-2 border-b border-og-line bg-white px-2 py-2 sm:grid">
                  <span className="text-xs font-bold text-og-dark">
                    Ingredient
                  </span>
                  <span className="text-xs font-bold text-og-dark">Qty</span>
                  <span className="text-xs font-bold text-og-dark">UOM</span>
                  <span className="sr-only">Actions</span>
                </div>

                <div className="divide-y divide-og-line">
                  {recipeLines.map((line, index) => (
                    <div
                      className="grid gap-2 px-2 py-2 sm:grid-cols-[minmax(0,1fr)_96px_96px_40px] sm:items-start"
                      key={index}
                    >
                      <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-og-gray">
                        <span className="sm:hidden">Ingredient</span>
                        <select
                          className={`h-9 w-full min-w-0 rounded-md border bg-white px-2 text-sm font-medium text-og-dark ${
                            fieldErrors[`lines.${index}.ingredientId`]
                              ? "border-og-error"
                              : "border-og-line"
                          }`}
                          onChange={(event) =>
                            updateRecipeLine(
                              index,
                              "ingredientId",
                              event.target.value,
                            )
                          }
                          required
                          value={line.ingredientId}
                        >
                          <option value="">Select ingredient</option>
                          {optionsFor(
                            {
                              key: "ingredientId",
                              label: "Ingredient item",
                              ref: "items",
                              type: "select",
                            },
                            records,
                          ).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <FieldError
                          message={fieldErrors[`lines.${index}.ingredientId`]}
                        />
                      </label>

                      <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-og-gray">
                        <span className="sm:hidden">Qty</span>
                        <input
                          className={`h-9 w-full rounded-md border px-2 text-sm font-medium text-og-dark ${
                            fieldErrors[`lines.${index}.qty`]
                              ? "border-og-error"
                              : "border-og-line"
                          }`}
                          onChange={(event) =>
                            updateRecipeLine(index, "qty", event.target.value)
                          }
                          required
                          step="0.000001"
                          type="number"
                          value={line.qty}
                        />
                        <FieldError
                          message={fieldErrors[`lines.${index}.qty`]}
                        />
                      </label>

                      <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-og-gray">
                        <span className="sm:hidden">UOM</span>
                        <select
                          className={`h-9 w-full rounded-md border bg-white px-2 text-sm font-medium text-og-dark ${
                            fieldErrors[`lines.${index}.uomId`]
                              ? "border-og-error"
                              : "border-og-line"
                          }`}
                          onChange={(event) =>
                            updateRecipeLine(index, "uomId", event.target.value)
                          }
                          required
                          value={line.uomId}
                        >
                          <option value="">UOM</option>
                          {optionsFor(
                            {
                              key: "uomId",
                              label: "Ingredient UOM",
                              ref: "uoms",
                              type: "select",
                            },
                            records,
                          ).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <FieldError
                          message={fieldErrors[`lines.${index}.uomId`]}
                        />
                      </label>

                      <button
                        className="h-9 justify-self-end rounded-md p-2 text-og-gray hover:bg-red-50 hover:text-og-error sm:mt-0"
                        onClick={() => removeRecipeLine(index)}
                        type="button"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeConfig.resource === "recipes" && selectedRecord ? (
            <div className="rounded-md border border-og-line bg-white p-3">
              <div className="mb-3 flex items-center gap-2">
                <Icon name="Calculator" size={16} className="text-og-green" />
                <p className="text-xs font-semibold uppercase tracking-normal text-og-gray">
                  Observed Yield
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
                  Expected output qty
                  <input
                    className="h-9 rounded-md border border-og-line px-2 text-sm font-medium text-og-dark"
                    onChange={(event) =>
                      setYieldObservation((current) => ({
                        ...current,
                        expectedOutputQty: event.target.value,
                      }))
                    }
                    step="0.000001"
                    type="number"
                    value={yieldObservation.expectedOutputQty}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
                  Actual usable output qty
                  <input
                    className="h-9 rounded-md border border-og-line px-2 text-sm font-medium text-og-dark"
                    onChange={(event) =>
                      setYieldObservation((current) => ({
                        ...current,
                        actualOutputQty: event.target.value,
                      }))
                    }
                    step="0.000001"
                    type="number"
                    value={yieldObservation.actualOutputQty}
                  />
                </label>
              </div>
              <label className="mt-2 flex flex-col gap-1 text-xs font-semibold text-og-gray">
                Notes
                <input
                  className="h-9 rounded-md border border-og-line px-2 text-sm font-medium text-og-dark"
                  onChange={(event) =>
                    setYieldObservation((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  value={yieldObservation.notes}
                />
              </label>
              <button
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-og-green bg-og-green px-3 text-sm font-semibold text-white hover:bg-[#0b3f10]"
                disabled={saving}
                onClick={submitYieldObservation}
                type="button"
              >
                <Icon name="Save" size={16} />
                Record observed yield
              </button>
            </div>
          ) : null}

          {formError && Object.keys(fieldErrors).length === 0 ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-og-error">
              {formError}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-og-green bg-og-green px-3 text-sm font-semibold text-white hover:bg-[#0b3f10]"
              disabled={saving || (!selectedRecord && !canCreateActiveResource)}
              type="submit"
            >
              <Icon name="Save" size={16} />
              <span>
                {saving ? "Saving" : selectedRecord ? "Update" : "Create"}
              </span>
            </button>
            {!selectedRecord && !canCreateActiveResource ? (
              <span className="self-center text-xs font-semibold text-og-gray">
                You do not have permission to create this record.
              </span>
            ) : null}

            {selectedRecord ? (
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-og-error bg-og-error px-3 text-sm font-semibold text-white hover:bg-[#b91c1c]"
                disabled={saving}
                onClick={deactivateSelected}
                type="button"
              >
                <Icon name="Trash2" size={16} />
                <span>Deactivate</span>
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}

function StateRow({
  columns,
  label,
  tone = "muted",
}: {
  columns: number;
  label: string;
  tone?: "error" | "muted";
}) {
  return (
    <tr className="border-t border-og-line">
      <td
        className={`og-table-cell py-8 text-center ${tone === "error" ? "font-semibold text-og-error" : "text-og-gray"}`}
        colSpan={columns}
      >
        {label}
      </td>
    </tr>
  );
}

function FilterControls({
  config,
  filters,
  onChange,
  onClear,
  records,
}: {
  config: ResourceConfig;
  filters: FilterState;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  records: ResourceState;
}) {
  const fields = filterFieldsWithOptions(filterFieldsFor(config), records);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-2 border-b border-og-line bg-[#fafbf8] p-3">
      <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(140px,180px))_auto]">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-og-gray">
          Search
          <span className="relative">
            <Icon
              name="Search"
              size={15}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-og-gray"
            />
            <input
              className="h-9 w-full rounded-md border border-og-line bg-white pl-8 pr-2 text-sm font-medium text-og-dark"
              onChange={(event) => onChange("search", event.target.value)}
              placeholder={`Search ${config.label.toLowerCase()}`}
              type="search"
              value={filters.search ?? ""}
            />
          </span>
        </label>

        {fields.map((field) => (
          <label
            className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-og-gray"
            key={field.key}
          >
            {field.label}
            <select
              className="h-9 w-full rounded-md border border-og-line bg-white px-2 text-sm font-medium text-og-dark"
              onChange={(event) => onChange(field.key, event.target.value)}
              value={filters[field.key] ?? ""}
            >
              <option value="">{field.allLabel}</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <button
          className="inline-flex h-9 items-center justify-center gap-1 self-end rounded-md border border-og-line bg-white px-2 text-xs font-semibold text-og-dark hover:border-og-green hover:text-og-green disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasFilters}
          onClick={onClear}
          type="button"
        >
          <Icon name="X" size={14} />
          Clear
        </button>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <span className="inline-flex items-start gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold leading-4 text-og-error">
      <Icon name="TriangleAlert" size={14} />
      {message}
    </span>
  );
}

function blankForm(config: ResourceConfig, records: ResourceState) {
  return Object.fromEntries(
    config.fields.map((field) => [
      field.key,
      field.type === "checkbox"
        ? "false"
        : field.optional
          ? ""
          : (optionsFor(field, records)[0]?.value ?? ""),
    ]),
  );
}

function formFromRecord(config: ResourceConfig, record: MasterDataRecord) {
  if (config.resource === "recipes") {
    return {
      outputItemId: text(record.outputItemId),
      servingQty: decimal(record.servingQty),
      version: text(record.version),
      wastageFactor: decimal(record.wastageFactor),
      wastageOverrideReason: text(record.wastageOverrideReason),
      yieldPercent: decimal(record.yieldPercent),
      yieldOverrideReason: text(record.yieldOverrideReason),
    };
  }

  if (config.resource === "uom-conversions") {
    return {
      conversionPerUnit: decimal(record.factor),
      factor: decimal(record.factor),
      fromUomId: text(record.fromUomId),
      toUomId: text(record.toUomId),
    };
  }

  if (config.resource === "supplier-items") {
    return Object.fromEntries(
      config.fields.map((field) => [
        field.key,
        field.type === "number"
          ? decimalForInput(record[field.key], 2)
          : text(record[field.key]),
      ]),
    );
  }

  return Object.fromEntries(
    config.fields.map((field) => [
      field.key,
      field.type === "checkbox"
        ? String(record[field.key] === true)
        : text(record[field.key]),
    ]),
  );
}

function recipeLinesFromRecord(record: MasterDataRecord) {
  if (!Array.isArray(record.lines)) {
    return [{ ...blankRecipeLine }];
  }

  const lines = (record.lines as MasterDataRecord[]).map((line) => ({
    ingredientId: text(line.ingredientId),
    qty: decimal(line.qty),
    uomId: text(line.uomId),
  }));

  return lines.length > 0 ? lines : [{ ...blankRecipeLine }];
}

function applyFilters(
  config: ResourceConfig,
  records: MasterDataRecord[],
  filters: FilterState,
) {
  const search = filters.search?.trim().toLowerCase();

  return records.filter((record) => {
    if (search && !searchText(record).includes(search)) {
      return false;
    }

    if (filters.active) {
      const active = record.active === false ? "false" : "true";

      if (active !== filters.active) {
        return false;
      }
    }

    switch (config.resource) {
      case "items":
        return (
          matches(record.itemType, filters.itemType) &&
          matches(record.categoryId, filters.categoryId)
        );
      case "supplier-items":
        return (
          matches(record.supplierId, filters.supplierId) &&
          matches(record.brand, filters.brand)
        );
      case "uom-conversions":
        return (
          matches(record.fromUomId, filters.fromUomId) &&
          matches(record.toUomId, filters.toUomId)
        );
      case "locations":
      case "reason-codes":
        return matches(record.type, filters.type);
      case "recipes":
        return matches(record.outputItemId, filters.outputItemId);
      default:
        return true;
    }
  });
}

function filterFieldsFor(config: ResourceConfig): FilterField[] {
  const fields: FilterField[] = [];

  if (config.resource !== "uom-conversions") {
    fields.push({
      allLabel: "All statuses",
      key: "active",
      label: "Status",
      options: [
        { label: "Active", value: "true" },
        { label: "Inactive", value: "false" },
      ],
    });
  }

  switch (config.resource) {
    case "items":
      fields.push(
        {
          allLabel: "All item types",
          key: "itemType",
          label: "Item type",
          options: itemTypeOptions,
        },
        {
          allLabel: "All categories",
          key: "categoryId",
          label: "Category",
          options: [],
        },
      );
      break;
    case "supplier-items":
      fields.push(
        {
          allLabel: "All suppliers",
          key: "supplierId",
          label: "Supplier",
          options: [],
        },
        {
          allLabel: "All brands",
          key: "brand",
          label: "Brand",
          options: [],
        },
      );
      break;
    case "uom-conversions":
      fields.push(
        {
          allLabel: "All source UOMs",
          key: "fromUomId",
          label: "From",
          options: [],
        },
        {
          allLabel: "All target UOMs",
          key: "toUomId",
          label: "To",
          options: [],
        },
      );
      break;
    case "locations":
      fields.push({
        allLabel: "All location types",
        key: "type",
        label: "Type",
        options: locationTypeOptions,
      });
      break;
    case "reason-codes":
      fields.push({
        allLabel: "All reason types",
        key: "type",
        label: "Type",
        options: reasonCodeTypeOptions,
      });
      break;
    case "recipes":
      fields.push({
        allLabel: "All output items",
        key: "outputItemId",
        label: "Output item",
        options: [],
      });
      break;
  }

  return fields;
}

function filterFieldsWithOptions(
  fields: FilterField[],
  records: ResourceState,
) {
  return fields.map((field) => {
    if (field.options.length > 0) {
      return field;
    }

    if (field.key === "categoryId") {
      return {
        ...field,
        options: optionsFor(
          {
            key: "categoryId",
            label: "Category",
            ref: "categories",
            type: "select",
          },
          records,
        ),
      };
    }

    if (field.key === "supplierId") {
      return {
        ...field,
        options: optionsFor(
          {
            key: "supplierId",
            label: "Supplier",
            ref: "suppliers",
            type: "select",
          },
          records,
        ),
      };
    }

    if (field.key === "brand") {
      return {
        ...field,
        options: uniqueBrandOptions(records["supplier-items"] ?? []),
      };
    }

    if (field.key === "fromUomId" || field.key === "toUomId") {
      return {
        ...field,
        options: optionsFor(
          { key: field.key, label: field.label, ref: "uoms", type: "select" },
          records,
        ),
      };
    }

    if (field.key === "outputItemId") {
      return {
        ...field,
        options: optionsFor(
          {
            key: "outputItemId",
            label: "Output item",
            ref: "items",
            type: "select",
          },
          records,
        ),
      };
    }

    return field;
  });
}

function validateForm(
  config: ResourceConfig,
  form: Record<string, string>,
  recipeLines: RecipeLineForm[],
) {
  const errors: FieldErrors = {};

  for (const field of config.fields) {
    const value = form[field.key]?.trim() ?? "";

    if (!field.optional && !value) {
      errors[field.key] = `${field.label} is required.`;
      continue;
    }

    if (field.type !== "number" || !value) {
      continue;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      errors[field.key] = `${field.label} must be a valid number.`;
      continue;
    }

    if (
      ["conversionPerUnit", "factor", "servingQty"].includes(field.key) &&
      numericValue <= 0
    ) {
      errors[field.key] = `${field.label} must be greater than zero.`;
    }

    if (
      ["looseWholeUnitQty", "lowStockThreshold", "wastageFactor"].includes(
        field.key,
      ) &&
      numericValue < 0
    ) {
      errors[field.key] = `${field.label} cannot be negative.`;
    }

    if (
      field.key === "version" &&
      (!Number.isInteger(numericValue) || numericValue < 1)
    ) {
      errors[field.key] = "Version must be a whole number greater than zero.";
    }

    if (
      field.key === "yieldPercent" &&
      (numericValue <= 0 || numericValue > 999.99)
    ) {
      errors[field.key] = "Yield percent must be between 0.01 and 999.99.";
    }

    if (field.key === "wastageFactor" && numericValue > 100) {
      errors[field.key] = "Wastage factor must be between 0 and 100.";
    }
  }

  if (
    config.resource === "uom-conversions" &&
    form.fromUomId &&
    form.fromUomId === form.toUomId
  ) {
    errors.toUomId = "Target UOM must be different from source UOM.";
  }

  if (config.resource === "items" && form.looseCountEnabled === "true") {
    if (!form.looseWholeUomId) {
      errors.looseWholeUomId = "Whole unit UOM is required for loose items.";
    }

    if (!form.looseRemainderUomId) {
      errors.looseRemainderUomId =
        "Loose count UOM is required for loose items.";
    }

    if (!form.looseWholeUnitQty || Number(form.looseWholeUnitQty) <= 0) {
      errors.looseWholeUnitQty =
        "Base qty per whole unit must be greater than zero.";
    }
  }

  if (config.resource === "recipes") {
    recipeLines.forEach((line, index) => {
      if (!line.ingredientId) {
        errors[`lines.${index}.ingredientId`] = "Ingredient item is required.";
      }

      if (line.ingredientId && line.ingredientId === form.outputItemId) {
        errors[`lines.${index}.ingredientId`] =
          "Ingredient item must be different from output item.";
      }

      if (!line.qty) {
        errors[`lines.${index}.qty`] = "Qty is required.";
      } else if (!Number.isFinite(Number(line.qty)) || Number(line.qty) <= 0) {
        errors[`lines.${index}.qty`] = "Qty must be greater than zero.";
      }

      if (!line.uomId) {
        errors[`lines.${index}.uomId`] = "UOM is required.";
      }
    });
  }

  return errors;
}

function toFieldErrors(config: ResourceConfig, message: string) {
  const normalizedMessage = message.toLowerCase();
  const errors: FieldErrors = {};

  for (const field of config.fields) {
    if (
      normalizedMessage.includes(field.key.toLowerCase()) ||
      normalizedMessage.includes(field.label.toLowerCase())
    ) {
      errors[field.key] = message;
      return errors;
    }
  }

  if (
    config.resource === "uom-conversions" &&
    normalizedMessage.includes("factor")
  ) {
    errors.conversionPerUnit = message;
  }

  return errors;
}

function payloadFromForm(
  config: ResourceConfig,
  form: Record<string, string>,
  recipeLines: RecipeLineForm[],
) {
  if (config.resource === "recipes") {
    return stripEmpty({
      outputItemId: form.outputItemId,
      version: numberOrUndefined(form.version),
      servingQty: numberOrUndefined(form.servingQty),
      yieldPercent: numberOrUndefined(form.yieldPercent),
      yieldOverrideReason: emptyToUndefined(form.yieldOverrideReason),
      wastageFactor: numberOrUndefined(form.wastageFactor),
      wastageOverrideReason: emptyToUndefined(form.wastageOverrideReason),
      lines: recipeLines.map((line) => ({
        ingredientId: line.ingredientId,
        qty: numberOrUndefined(line.qty),
        uomId: line.uomId,
      })),
    });
  }

  if (config.resource === "uom-conversions") {
    return stripEmpty({
      factor: numberOrUndefined(form.conversionPerUnit || form.factor),
      fromUomId: emptyToUndefined(form.fromUomId),
      toUomId: emptyToUndefined(form.toUomId),
    });
  }

  return stripEmpty(
    Object.fromEntries(
      config.fields
        .filter((field) => field.key !== "baseUomDisplay")
        .map((field) => [
          field.key,
          field.type === "checkbox"
            ? form[field.key] === "true"
            : field.type === "number"
              ? numberOrUndefined(form[field.key])
              : emptyToUndefined(form[field.key]),
        ]),
    ),
  );
}

function optionsFor(field: Field, records: ResourceState) {
  if (field.options) {
    return field.options;
  }

  if (!field.ref) {
    return [];
  }

  return (records[field.ref] ?? [])
    .filter((record) => record.active !== false)
    .map((record) => ({
      label: relatedLabel(record),
      value: record.id,
    }));
}

function relatedLabel(record: MasterDataRecord) {
  return (
    [record.code, record.sku, record.name].map(text).find(Boolean) ??
    record.id.slice(0, 8)
  );
}

function matches(value: unknown, filterValue?: string) {
  return !filterValue || text(value) === filterValue;
}

function searchText(record: MasterDataRecord) {
  const parts = [
    record.code,
    record.sku,
    record.name,
    record.itemType,
    record.type,
    record.contactName,
    record.email,
    record.phone,
    record.paymentTerms,
    record.factor,
    record.version,
    record.servingQty,
    record.totalRecipeCost,
    record.costPerServing,
    record.yieldPercent,
    record.yieldOverrideReason,
    record.wastageFactor,
    record.wastageOverrideReason,
    relatedCode(record.baseUom),
    relatedName(record.category),
    relatedCode(record.fromUom),
    relatedCode(record.toUom),
    relatedName(record.outputItem),
    record.brand,
    record.supplierSku,
    record.packSize,
    relatedCode(record.item),
    relatedName(record.item),
    relatedCode(record.purchaseUom),
    relatedName(record.supplier),
  ];

  if (Array.isArray(record.lines)) {
    for (const line of record.lines as MasterDataRecord[]) {
      parts.push(relatedName(line.ingredient), relatedCode(line.uom), line.qty);
    }
  }

  return parts.map(text).join(" ").toLowerCase();
}

function uniqueBrandOptions(records: MasterDataRecord[]) {
  return Array.from(
    new Set(
      records
        .map((record) => text(record.brand).trim())
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second)),
    ),
  ).map((brand) => ({ label: brand, value: brand }));
}

function relatedCode(value: unknown) {
  if (!isRecord(value)) {
    return "-";
  }

  return text(value.code) || text(value.sku) || text(value.name) || "-";
}

function relatedName(value: unknown) {
  if (!isRecord(value)) {
    return "-";
  }

  return text(value.name) || text(value.sku) || text(value.code) || "-";
}

function looseItemLabel(record: MasterDataRecord) {
  if (record.looseCountEnabled !== true) {
    return "No";
  }

  return `${decimal(record.looseWholeUnitQty)} ${relatedCode(record.looseWholeUom)} -> ${relatedCode(record.baseUom)} / ${relatedCode(record.looseRemainderUom)}`;
}

function supplierItemConversionLabel(record: MasterDataRecord) {
  if (record.conversionToBase === null || record.conversionToBase === undefined) {
    return "-";
  }

  const purchaseUom = relatedCode(record.purchaseUom);
  const baseUom = isRecord(record.item) ? relatedCode(record.item.baseUom) : "-";

  return `1 ${purchaseUom} = ${decimal(record.conversionToBase, 2)} ${baseUom}`;
}

function status(active: unknown) {
  return active === false ? "Inactive" : "Active";
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function decimal(value: unknown, maximumFractionDigits = 6) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return Number(value).toLocaleString("en-PH", { maximumFractionDigits });
}

function decimalForInput(value: unknown, fractionDigits: number) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue.toFixed(fractionDigits) : "";
}

function usesTwoDecimalInput(config: ResourceConfig, field: Field) {
  return (
    config.resource === "supplier-items" &&
    (field.key === "conversionToBase" || field.key === "unitCost")
  );
}

function supplierItemBaseUomValue(
  config: ResourceConfig,
  field: Field,
  form: Record<string, string>,
  records: ResourceState,
) {
  if (config.resource !== "supplier-items" || field.key !== "baseUomDisplay") {
    return null;
  }

  return selectedItemBaseUom(form.itemId, records);
}

function supplierItemConversionHint(
  config: ResourceConfig,
  field: Field,
  form: Record<string, string>,
  records: ResourceState,
) {
  if (config.resource !== "supplier-items" || field.key !== "baseUomDisplay") {
    return "";
  }

  const purchaseUom = records.uoms?.find(
    (record) => record.id === form.purchaseUomId,
  );
  const baseUom = selectedItemBaseUom(form.itemId, records);

  if (!purchaseUom || !baseUom) {
    return "";
  }

  return `Purchase UOM to Base: 1 ${relatedCode(purchaseUom)} = ${
    form.conversionToBase || "0.00"
  } ${baseUom}`;
}

function selectedItemBaseUom(itemId: string | undefined, records: ResourceState) {
  const item = records.items?.find((record) => record.id === itemId);
  const baseUom = isRecord(item?.baseUom)
    ? relatedCode(item?.baseUom)
    : relatedCode(
        records.uoms?.find((record) => record.id === item?.baseUomId),
      );

  return baseUom === "-" ? "" : baseUom;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function emptyToUndefined(value: string | undefined) {
  return value === undefined || value === "" ? undefined : value;
}

function numberOrUndefined(value: string | undefined) {
  return value === undefined || value === "" ? undefined : Number(value);
}

function stripEmpty(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function toOption(value: string) {
  return { label: value.replaceAll("_", " "), value };
}

function canCreateResource(
  resource: MasterDataResource,
  user: AuthenticatedUser | null,
) {
  return user?.permissions.includes(`${permissionPrefix(resource)}:create`) ?? false;
}

function canImportMasterDataTemplate(user: AuthenticatedUser | null) {
  return configs.every(
    (config) =>
      user?.permissions.includes(`${permissionPrefix(config.resource)}:create`) &&
      user.permissions.includes(`${permissionPrefix(config.resource)}:update`),
  );
}

function canDownloadMasterDataTemplate(user: AuthenticatedUser | null) {
  return configs.every((config) =>
    user?.permissions.includes(`${permissionPrefix(config.resource)}:read`),
  );
}

function canReadResource(
  resource: MasterDataResource,
  user: AuthenticatedUser | null,
) {
  return user?.permissions.includes(`${permissionPrefix(resource)}:read`) ?? false;
}

function permissionPrefix(resource: MasterDataResource) {
  return resource === "supplier-items"
    ? "master-data.suppliers"
    : `master-data.${resource}`;
}

function resourcesNeededFor(
  resource: MasterDataResource | undefined,
  user: AuthenticatedUser | null,
) {
  if (!resource || !canReadResource(resource, user)) {
    return [];
  }

  const config = configs.find((entry) => entry.resource === resource);
  const resources = new Set<MasterDataResource>([resource]);

  for (const field of config?.fields ?? []) {
    if (field.ref && canReadResource(field.ref, user)) {
      resources.add(field.ref);
    }
  }

  if (resource === "recipes") {
    for (const ref of ["items", "uoms"] as MasterDataResource[]) {
      if (canReadResource(ref, user)) {
        resources.add(ref);
      }
    }
  }

  return Array.from(resources);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function downloadBase64File(base64: string, filename: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  downloadBlob(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
