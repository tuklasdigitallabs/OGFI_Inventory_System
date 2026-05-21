"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApiClient,
  TOKEN_KEY,
  type AuthenticatedUser,
  type MasterDataRecord,
  type MenuPrice,
} from "@/lib/api-client";
import { Icon } from "@/lib/icons";
import type { Screen } from "@/lib/screens";
import { StatusBadge } from "./status-badge";

type MenuPricingLivePageProps = {
  screen: Screen;
};

type PricingForm = {
  channel: string;
  effectiveDate: string;
  effectiveEndDate: string;
  locationId: string;
  notes: string;
  recipeId: string;
  sellingPrice: string;
  targetFoodCostPercent: string;
  targetGrossMarginPercent: string;
};

const blankForm: PricingForm = {
  channel: "BASE",
  effectiveDate: "",
  effectiveEndDate: "",
  locationId: "",
  notes: "",
  recipeId: "",
  sellingPrice: "",
  targetFoodCostPercent: "",
  targetGrossMarginPercent: "",
};

export function MenuPricingLivePage({ screen }: MenuPricingLivePageProps) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PricingForm>(blankForm);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<MasterDataRecord[]>([]);
  const [prices, setPrices] = useState<MenuPrice[]>([]);
  const [recipes, setRecipes] = useState<MasterDataRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const selectedPrice = prices.find((price) => price.id === selectedId) ?? null;
  const canCreate = user?.permissions.includes("menu-pricing:create") ?? false;
  const canApprove =
    user?.permissions.includes("menu-pricing:approve") ?? false;
  const activeRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.active !== false),
    [recipes],
  );
  const filteredPrices = useMemo(
    () =>
      statusFilter
        ? prices.filter((price) => price.status === statusFilter)
        : prices,
    [prices, statusFilter],
  );
  const isPromoChannel = form.channel.trim().toUpperCase() === "PROMO";

  useEffect(() => {
    const status = normalizeMenuPriceStatus(
      new URLSearchParams(window.location.search).get("status") ?? "",
    );

    if (status) {
      setStatusFilter(status);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = window.localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setError("Sign in again to load menu pricing.");
        setLoading(false);
        return;
      }

      try {
        const client = new ApiClient(token);
        const [currentUser, priceResponse, recipeResponse, locationResponse] =
          await Promise.all([
            client.currentUser(),
            client.menuPrices(),
            client.masterData("recipes"),
            client.masterData("locations"),
          ]);

        if (!cancelled) {
          setUser(currentUser);
          setPrices(priceResponse.data);
          setRecipes(recipeResponse.data);
          setLocations(locationResponse.data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load menu pricing.",
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

  function updateField(key: keyof PricingForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function selectPrice(price: MenuPrice) {
    if (selectedId === price.id) {
      clearSelection();
      return;
    }

    setSelectedId(price.id);
    setForm({
      channel: price.channel,
      effectiveDate: price.effectiveDate.slice(0, 10),
      effectiveEndDate: price.effectiveEndDate?.slice(0, 10) ?? "",
      locationId: price.locationId ?? "",
      notes: price.notes ?? "",
      recipeId: price.recipeId,
      sellingPrice: decimalInput(price.sellingPrice),
      targetFoodCostPercent: decimalInput(price.targetFoodCostPercent),
      targetGrossMarginPercent: decimalInput(price.targetGrossMarginPercent),
    });
  }

  function clearSelection() {
    setSelectedId(null);
    setForm(blankForm);
    setError(null);
  }

  async function refresh(client: ApiClient) {
    const response = await client.menuPrices();
    setPrices(response.data);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreate) {
      setError("You do not have permission to create menu pricing drafts.");
      return;
    }

    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setError("Sign in again before saving menu pricing.");
      return;
    }

    if (!form.recipeId || !form.sellingPrice || !form.effectiveDate) {
      setError("Recipe, selling price, and effective date are required.");
      return;
    }

    if (isPromoChannel && !form.effectiveEndDate) {
      setError("Promo prices require an end date.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const client = new ApiClient(token);
      const payload: Record<string, unknown> = {
        channel: form.channel,
        effectiveDate: form.effectiveDate,
        effectiveEndDate: isPromoChannel
          ? emptyToUndefined(form.effectiveEndDate)
          : null,
        locationId: emptyToUndefined(form.locationId),
        notes: emptyToUndefined(form.notes),
        sellingPrice: Number(form.sellingPrice),
        targetFoodCostPercent: numberOrUndefined(form.targetFoodCostPercent),
        targetGrossMarginPercent: numberOrUndefined(
          form.targetGrossMarginPercent,
        ),
      };

      if (selectedId) {
        await client.updateMenuPrice(selectedId, payload);
      } else {
        await client.createMenuPrice({ ...payload, recipeId: form.recipeId });
      }

      await refresh(client);
      clearSelection();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save menu pricing.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function action(id: string, type: "approve" | "clone" | "submit") {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setError("Sign in again before updating menu pricing.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const client = new ApiClient(token);

      if (type === "approve") {
        await client.approveMenuPrice(id);
      } else if (type === "clone") {
        await client.cloneMenuPrice(id);
      } else {
        await client.submitMenuPrice(id);
      }

      await refresh(client);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update menu pricing.",
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="og-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-og-line p-4">
            <div className="flex items-center gap-2">
              <Icon name="Utensils" size={20} className="text-og-green" />
              <h2 className="font-poppins text-xl font-semibold text-og-dark">
                Menu Prices
              </h2>
            </div>
            <span className="text-xs font-semibold text-og-gray">
              {filteredPrices.length} records
            </span>
          </div>

          <div className="border-b border-og-line p-4">
            <label className="flex max-w-xs flex-col gap-1 text-xs font-semibold text-og-gray">
              Status
              <select
                className="h-10 rounded-md border border-og-line bg-white px-3 text-sm font-medium text-og-dark"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending approval</option>
                <option value="APPROVED">Approved</option>
                <option value="ARCHIVED">Archived</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
          </div>

          {error ? (
            <p className="m-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-og-error">
              {error}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {[
                    "Item",
                    "Recipe",
                    "Channel",
                    "Price",
                    "End",
                    "Cost / Serving",
                    "Food Cost",
                    "Margin",
                    "Target",
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
                {loading ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-og-gray"
                      colSpan={11}
                    >
                      Loading menu pricing
                    </td>
                  </tr>
                ) : null}
                {!loading && filteredPrices.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-og-gray"
                      colSpan={11}
                    >
                      No menu pricing records found
                    </td>
                  </tr>
                ) : null}
                {!loading
                  ? filteredPrices.map((price) => (
                      <tr
                        className={`cursor-pointer border-t border-og-line ${
                          selectedId === price.id
                            ? "bg-green-50"
                            : "hover:bg-[#fff5e4]"
                        }`}
                        key={price.id}
                        onClick={() => selectPrice(price)}
                      >
                        <td className="og-table-cell">
                          {relatedLabel(price.outputItem)}
                        </td>
                        <td className="og-table-cell">
                          v{relatedText(price.recipe?.version)}
                        </td>
                        <td className="og-table-cell">{price.channel}</td>
                        <td className="og-table-cell">
                          {formatCurrency(Number(price.sellingPrice))}
                        </td>
                        <td className="og-table-cell">
                          {price.effectiveEndDate
                            ? formatDate(price.effectiveEndDate)
                            : "-"}
                        </td>
                        <td className="og-table-cell">
                          {formatCurrency(Number(price.costPerServing))}
                        </td>
                        <td className="og-table-cell">
                          {decimal(price.foodCostPercent)}%
                        </td>
                        <td className="og-table-cell">
                          {decimal(price.grossMarginPercent)}%
                        </td>
                        <td className="og-table-cell">
                          <TargetComparison price={price} />
                        </td>
                        <td className="og-table-cell">
                          <StatusBadge
                            value={statusLabel(
                              price.displayStatus ?? price.status,
                            )}
                          />
                        </td>
                        <td className="og-table-cell">
                          <div className="flex gap-1">
                            {price.status === "DRAFT" && canCreate ? (
                              <button
                                className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green"
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void action(price.id, "submit");
                                }}
                                type="button"
                              >
                                <Icon name="Send" size={16} />
                              </button>
                            ) : null}
                            {price.status === "APPROVED" && canCreate ? (
                              <button
                                className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green"
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void action(price.id, "clone");
                                }}
                                type="button"
                                title="Clone to draft"
                              >
                                <Icon name="FilePlus2" size={16} />
                              </button>
                            ) : null}
                            {price.status === "PENDING_APPROVAL" &&
                            canApprove ? (
                              <button
                                className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green"
                                disabled={saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void action(price.id, "approve");
                                }}
                                type="button"
                              >
                                <Icon name="Check" size={16} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </div>

        <form className="og-card flex flex-col gap-3" onSubmit={submit}>
          <div className="flex items-center justify-between">
            <h2 className="font-poppins text-lg font-semibold text-og-dark">
              {selectedPrice ? "Update Draft Price" : "Create Draft Price"}
            </h2>
            {selectedPrice ? (
              <button
                className="rounded-md p-2 text-og-gray hover:bg-orange-50 hover:text-og-dark"
                onClick={clearSelection}
                type="button"
              >
                <Icon name="X" size={18} />
              </button>
            ) : null}
          </div>

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Recipe
            <select
              className="h-10 rounded-md border border-og-line bg-white px-3 text-sm font-medium text-og-dark"
              disabled={Boolean(selectedId)}
              onChange={(event) => updateField("recipeId", event.target.value)}
              required
              value={form.recipeId}
            >
              <option value="">Select recipe</option>
              {activeRecipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {relatedLabel(recipe.outputItem)} v
                  {relatedText(recipe.version)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Location
            <select
              className="h-10 rounded-md border border-og-line bg-white px-3 text-sm font-medium text-og-dark"
              onChange={(event) =>
                updateField("locationId", event.target.value)
              }
              value={form.locationId}
            >
              <option value="">All locations</option>
              {locations
                .filter((location) => location.active !== false)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {relatedLabel(location)}
                  </option>
                ))}
            </select>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
              Channel
              <input
                className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
                onChange={(event) => updateField("channel", event.target.value)}
                required
                value={form.channel}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
              Effective date
              <input
                className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
                onChange={(event) =>
                  updateField("effectiveDate", event.target.value)
                }
                required
                type="date"
                value={form.effectiveDate}
              />
            </label>
          </div>

          {isPromoChannel ? (
            <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
              Promo end date
              <input
                className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
                min={form.effectiveDate || undefined}
                onChange={(event) =>
                  updateField("effectiveEndDate", event.target.value)
                }
                required
                type="date"
                value={form.effectiveEndDate}
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Selling price
            <input
              className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
              min="0.01"
              onChange={(event) =>
                updateField("sellingPrice", event.target.value)
              }
              required
              step="0.01"
              type="number"
              value={form.sellingPrice}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
              Target food cost %
              <input
                className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
                onChange={(event) =>
                  updateField("targetFoodCostPercent", event.target.value)
                }
                step="0.01"
                type="number"
                value={form.targetFoodCostPercent}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
              Target margin %
              <input
                className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
                onChange={(event) =>
                  updateField("targetGrossMarginPercent", event.target.value)
                }
                step="0.01"
                type="number"
                value={form.targetGrossMarginPercent}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Notes
            <input
              className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
              onChange={(event) => updateField("notes", event.target.value)}
              value={form.notes}
            />
          </label>

          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-og-green bg-og-green px-3 text-sm font-semibold text-white hover:bg-[#0b3f10] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || !canCreate}
            type="submit"
          >
            <Icon name="Save" size={16} />
            {saving
              ? "Saving"
              : selectedPrice
                ? "Update Draft"
                : "Create Draft"}
          </button>

          {!canCreate ? (
            <p className="text-xs font-semibold text-og-gray">
              Only warehouse or HQ users can create menu pricing drafts.
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}

function relatedLabel(record: unknown) {
  if (!record || typeof record !== "object") {
    return "-";
  }

  const value = record as Record<string, unknown>;
  return (
    [value.sku, value.code, value.name].map(relatedText).find(Boolean) ?? "-"
  );
}

function TargetComparison({ price }: { price: MenuPrice }) {
  const comparison = compareTarget(price);

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${comparison.className}`}
    >
      {comparison.label}
    </span>
  );
}

function compareTarget(price: MenuPrice) {
  const foodCostTarget = numericOrNull(price.targetFoodCostPercent);

  if (foodCostTarget !== null) {
    const actualFoodCost = Number(price.foodCostPercent);

    if (actualFoodCost <= foodCostTarget) {
      return {
        className: "border-green-200 bg-green-50 text-og-green",
        label: "Meets target",
      };
    }

    return {
      className: "border-red-200 bg-red-50 text-og-error",
      label: "Above target",
    };
  }

  const marginTarget = numericOrNull(price.targetGrossMarginPercent);

  if (marginTarget !== null) {
    const actualMargin = Number(price.grossMarginPercent);

    if (actualMargin >= marginTarget) {
      return {
        className: "border-green-200 bg-green-50 text-og-green",
        label: "Meets target",
      };
    }

    return {
      className: "border-red-200 bg-red-50 text-og-error",
      label: "Below target",
    };
  }

  return {
    className: "border-og-line bg-gray-50 text-og-gray",
    label: "No target",
  };
}

function numericOrNull(value: string | null) {
  if (value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function relatedText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  return Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

function decimalInput(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(Number(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function emptyToUndefined(value: string) {
  return value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value: string) {
  return value === "" ? undefined : Number(value);
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeMenuPriceStatus(value: string) {
  const normalized = value.trim().toUpperCase();

  return [
    "APPROVED",
    "ARCHIVED",
    "DRAFT",
    "PENDING_APPROVAL",
    "REJECTED",
  ].includes(normalized)
    ? normalized
    : "";
}
