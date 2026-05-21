"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "./action-button";
import { DataTable } from "./data-table";
import { FilterBar } from "./filter-bar";
import { KpiCard } from "./kpi-card";
import { Icon } from "@/lib/icons";
import type { Kpi, Screen } from "@/lib/screens";
import {
  ApiClient,
  TOKEN_KEY,
  type LedgerMovementRow,
  type MenuPrice,
  type PurchaseOrder,
  type StockOnHandRow,
  type Transfer,
} from "@/lib/api-client";

type DashboardLivePageProps = {
  screen: Screen;
};

type DashboardState = {
  loading: boolean;
  movements: LedgerMovementRow[];
  menuPrices: MenuPrice[];
  purchaseOrders: PurchaseOrder[];
  stock: StockOnHandRow[];
  transfers: Transfer[];
};

type QuickActionSeverity = "critical" | "high" | "medium" | "low";

type QuickAction = {
  href: string;
  label: string;
  meta: string;
  severity: QuickActionSeverity;
  value: string;
};

export function DashboardLivePage({ screen }: DashboardLivePageProps) {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    menuPrices: [],
    movements: [],
    purchaseOrders: [],
    stock: [],
    transfers: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStockSummary() {
      const token = window.localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setState(emptyDashboardState(false));
        return;
      }

      try {
        const client = new ApiClient(token);
        const user = await client.currentUser();
        const [
          stockResponses,
          movementResponses,
          transferResponse,
          purchaseOrderResponse,
          menuPriceResponse,
        ] = await Promise.all([
          Promise.all(
            user.locationIds.map((locationId) =>
              client.stockOnHand(locationId),
            ),
          ),
          Promise.all(
            user.locationIds.map((locationId) =>
              client.inventoryMovements(locationId, 10),
            ),
          ),
          client
            .transfers()
            .catch(() => ({ resource: "transfers", data: [] })),
          client
            .purchaseOrders()
            .catch(() => ({ resource: "purchase-orders", data: [] })),
          client
            .menuPrices()
            .catch(() => ({ resource: "menu-pricing", data: [] })),
        ]);

        if (!cancelled) {
          setState({
            loading: false,
            menuPrices: menuPriceResponse.data,
            movements: movementResponses.flatMap((response) => response.data),
            purchaseOrders: purchaseOrderResponse.data.filter((purchaseOrder) =>
              user.locationIds.includes(purchaseOrder.locationId),
            ),
            stock: stockResponses.flatMap((response) => response.data),
            transfers: transferResponse.data.filter(
              (transfer) =>
                user.locationIds.includes(transfer.sourceLocationId) ||
                user.locationIds.includes(transfer.targetLocationId),
            ),
          });
        }
      } catch {
        if (!cancelled) {
          setState(emptyDashboardState(false));
        }
      }
    }

    void loadStockSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(
    () =>
      mergeDashboardKpis(
        screen.kpis,
        state.stock,
        state.transfers,
        state.loading,
      ),
    [screen.kpis, state.loading, state.stock, state.transfers],
  );
  const quickActions = useMemo(
    () =>
      buildQuickActions(
        state.purchaseOrders,
        state.transfers,
        state.menuPrices,
        state.stock,
        state.loading,
      ),
    [
      state.loading,
      state.menuPrices,
      state.purchaseOrders,
      state.stock,
      state.transfers,
    ],
  );
  const locationCodes = useMemo(
    () => new Map(state.stock.map((row) => [row.locationId, row.locationCode])),
    [state.stock],
  );
  const movementRows = useMemo(
    () =>
      [...state.movements]
        .sort(sortMovementsNewestFirst)
        .slice(0, 10)
        .map((row) => toMovementTableRow(row, locationCodes)),
    [locationCodes, state.movements],
  );

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
          {screen.actions.map((action) => (
            <ActionButton action={action} key={action.label} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      <section className="og-card">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="ListChecks" size={20} className="text-og-green" />
          <h2 className="font-poppins text-lg font-semibold text-og-dark">
            Quick Actions and Alerts
          </h2>
        </div>
        {quickActions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const severity = quickActionSeverity[action.severity];

              return (
                <Link
                  className={`relative overflow-hidden rounded-md border bg-white p-3 transition hover:-translate-y-px hover:shadow-sm ${severity.card}`}
                  href={action.href}
                  key={action.label}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${severity.accent}`}
                  />
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-og-dark">
                          {action.label}
                        </p>
                        <span
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-normal ${severity.badge}`}
                        >
                          {severity.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-og-gray">{action.meta}</p>
                    </div>
                    <span className="shrink-0 font-poppins text-2xl font-semibold text-og-dark">
                      {action.value}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-og-line bg-[#f8faf8] p-4 text-sm font-semibold text-og-gray">
            {state.loading
              ? "Loading action queue..."
              : "No approvals or alerts need action right now."}
          </div>
        )}
      </section>

      <FilterBar filters={screen.filters} />
      <DataTable
        columns={["Date/Time", "Location", "Movement", "Reference", "Status"]}
        emptyMessage="No recent movements found"
        loading={state.loading}
        rows={movementRows}
        title="Recent Movement Table"
      />
    </div>
  );
}

function emptyDashboardState(loading: boolean): DashboardState {
  return {
    loading,
    menuPrices: [],
    movements: [],
    purchaseOrders: [],
    stock: [],
    transfers: [],
  };
}

function buildQuickActions(
  purchaseOrders: PurchaseOrder[],
  transfers: Transfer[],
  menuPrices: MenuPrice[],
  stock: StockOnHandRow[],
  loading: boolean,
) {
  const purchaseApprovals = purchaseOrders.filter(
    (purchaseOrder) => purchaseOrder.status === "PENDING_APPROVAL",
  ).length;
  const transferApprovals = transfers.filter((transfer) =>
    ["DRAFT", "PENDING_APPROVAL"].includes(transfer.status),
  ).length;
  const lowStockTransferApprovals = transfers.filter(
    (transfer) =>
      transfer.requiresLowStockApproval &&
      ["DRAFT", "PENDING_APPROVAL"].includes(transfer.status),
  ).length;
  const varianceReviews = transfers.filter(
    (transfer) => transfer.status === "VARIANCE_REVIEW",
  ).length;
  const pricingApprovals = menuPrices.filter(
    (price) => price.status === "PENDING_APPROVAL",
  ).length;
  const lowStock = stock.filter((row) => inventoryStatus(row) === "LOW").length;
  const emptyStock = stock.filter(
    (row) => inventoryStatus(row) === "OUT_OF_STOCK",
  ).length;

  const actions: QuickAction[] = [];

  if (purchaseApprovals > 0) {
    actions.push({
      href: "/purchasing?status=PENDING_APPROVAL",
      label: "PO Approvals",
      meta: "Purchase orders awaiting approval",
      severity: "medium",
      value: formatInteger(purchaseApprovals),
    });
  }

  if (transferApprovals > 0) {
    actions.push({
      href: "/transfers?status=PENDING",
      label: "Transfer Approvals",
      meta: "Transfer requests awaiting approval",
      severity: "high",
      value: formatInteger(transferApprovals),
    });
  }

  if (lowStockTransferApprovals > 0) {
    actions.push({
      href: "/transfers?status=PENDING&approval=low-stock",
      label: "Low Stock Transfer Approvals",
      meta: "Requests that need manager approval",
      severity: "high",
      value: formatInteger(lowStockTransferApprovals),
    });
  }

  if (varianceReviews > 0) {
    actions.push({
      href: "/transfers?status=VARIANCE_REVIEW",
      label: "Variance Reviews",
      meta: "Transfer variances to resolve",
      severity: "critical",
      value: formatInteger(varianceReviews),
    });
  }

  if (pricingApprovals > 0) {
    actions.push({
      href: "/menu-pricing?status=PENDING_APPROVAL",
      label: "Menu Pricing Approvals",
      meta: "Pricing drafts awaiting approval",
      severity: "medium",
      value: formatInteger(pricingApprovals),
    });
  }

  if (lowStock + emptyStock > 0) {
    actions.push({
      href: "/inventory?stockStatus=LOW_OR_EMPTY",
      label: "Stock Alerts",
      meta: "Low and empty inventory rows",
      severity: emptyStock > 0 ? "critical" : "high",
      value: `Empty ${formatInteger(emptyStock)} / Low ${formatInteger(lowStock)}`,
    });
  }

  return loading ? [] : actions;
}

const quickActionSeverity: Record<
  QuickActionSeverity,
  {
    accent: string;
    badge: string;
    card: string;
    label: string;
  }
> = {
  critical: {
    accent: "bg-red-600",
    badge: "bg-red-100 text-red-700",
    card: "border-red-200 hover:border-red-500 hover:bg-red-50",
    label: "Critical",
  },
  high: {
    accent: "bg-orange-500",
    badge: "bg-orange-100 text-[#8a5200]",
    card: "border-orange-200 hover:border-orange-500 hover:bg-orange-50",
    label: "High",
  },
  medium: {
    accent: "bg-amber-400",
    badge: "bg-amber-100 text-[#8a5200]",
    card: "border-amber-200 hover:border-amber-500 hover:bg-amber-50",
    label: "Medium",
  },
  low: {
    accent: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700",
    card: "border-blue-200 hover:border-blue-500 hover:bg-blue-50",
    label: "Low",
  },
};

function mergeDashboardKpis(
  kpis: Kpi[],
  stock: StockOnHandRow[],
  transfers: Transfer[],
  loading: boolean,
) {
  const stockValue = stock.reduce(
    (total, row) => total + Number(row.inventoryValue),
    0,
  );
  const lowStock = stock.filter(
    (row) =>
      row.stockStatus === "LOW" || (!row.stockStatus && row.belowLowStock),
  ).length;
  const emptyStock = stock.filter(
    (row) => inventoryStatus(row) === "OUT_OF_STOCK",
  ).length;
  const pendingTransfers = transfers.filter((transfer) =>
    ["DRAFT", "PENDING_APPROVAL"].includes(transfer.status),
  ).length;
  const inTransitTransfers = transfers.filter(
    (transfer) => transfer.status === "DISPATCHED",
  ).length;
  const unreceivedByEod = transfers.filter(
    (transfer) =>
      transfer.status === "DISPATCHED" &&
      isBeforeToday(transfer.updatedAt ?? transfer.createdAt),
  ).length;
  const variances = transfers.filter(
    (transfer) => transfer.status === "VARIANCE_REVIEW",
  ).length;
  const blockedLocations = new Set(
    transfers
      .filter((transfer) =>
        ["DISPATCHED", "VARIANCE_REVIEW"].includes(transfer.status),
      )
      .flatMap((transfer) => [
        transfer.sourceLocationId,
        transfer.targetLocationId,
      ]),
  ).size;

  return kpis
    .map((kpi) => {
      if (kpi.label === "Total Stock Value") {
        return {
          ...kpi,
          href: "/inventory",
          value: loading ? "..." : formatCurrency(stockValue),
          meta: "From live stock balances",
        };
      }

      if (kpi.label === "Low Stock") {
        return {
          ...kpi,
          href: "/inventory?stockStatus=LOW_OR_EMPTY",
          label: "Stock Alerts",
          value: loading
            ? "..."
            : `Low ${formatInteger(lowStock)} / Empty ${formatInteger(emptyStock)}`,
          meta: "Low and empty stock rows",
          tone:
            emptyStock > 0 ? "danger" : lowStock > 0 ? "warning" : "success",
        } satisfies Kpi;
      }

      if (kpi.label === "Pending Transfers") {
        return {
          ...kpi,
          href: "/transfers?status=PENDING",
          value: loading ? "..." : formatInteger(pendingTransfers),
          meta: "Awaiting transfer approval",
          tone: pendingTransfers > 0 ? "warning" : "success",
        } satisfies Kpi;
      }

      if (kpi.label === "Variance") {
        return {
          ...kpi,
          href: "/transfers?status=VARIANCE_REVIEW",
          value: loading ? "..." : formatInteger(variances),
          meta: "Transfer variances needing review",
          tone: variances > 0 ? "warning" : "success",
        } satisfies Kpi;
      }

      return kpi;
    })
    .concat([
      {
        label: "In Transit Transfers",
        href: "/transfers?status=DISPATCHED",
        value: loading ? "..." : formatInteger(inTransitTransfers),
        meta: "Dispatched, not yet received",
        icon: "Route",
        tone: inTransitTransfers > 0 ? "info" : "success",
      },
      {
        label: "Unreceived By EOD",
        href: "/transfers?status=DISPATCHED&overdue=true",
        value: loading ? "..." : formatInteger(unreceivedByEod),
        meta: "Dispatched before today",
        icon: "TriangleAlert",
        tone: unreceivedByEod > 0 ? "warning" : "success",
      },
      {
        label: "Blocked EOD Locations",
        href: "/store-operations?blocked=eod",
        value: loading ? "..." : formatInteger(blockedLocations),
        meta: "Has transfer blockers",
        icon: "LockKeyhole",
        tone: blockedLocations > 0 ? "danger" : "success",
      },
    ] satisfies Kpi[]);
}

function inventoryStatus(row: StockOnHandRow) {
  if (row.stockStatus) {
    return row.stockStatus;
  }

  if (Number(row.availableQty ?? row.qtyOnHand) <= 0) {
    return "OUT_OF_STOCK";
  }

  return row.belowLowStock ? "LOW" : "OK";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
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

function isBeforeToday(value: string) {
  const date = new Date(value);
  const today = new Date();

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return date.getTime() < today.getTime();
}

function movementStatus(row: LedgerMovementRow) {
  if (
    row.transactionType === "TRANSFER_IN" ||
    row.transactionType === "TRANSFER_OUT"
  ) {
    return "Posted";
  }

  return row.referenceType === "ADJUSTMENT" ? "Posted" : "Posted";
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

function toMovementTableRow(
  row: LedgerMovementRow,
  locationCodes: Map<string, string>,
) {
  return [
    formatDateTime(row.businessDate),
    locationCodes.get(row.locationId) ?? row.locationId.slice(0, 8),
    row.transactionType,
    `${row.referenceType}:${row.referenceId.slice(0, 8)}`,
    movementStatus(row),
  ];
}
