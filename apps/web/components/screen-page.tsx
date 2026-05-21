import { ActionButton } from "./action-button";
import { AdminLivePage } from "./admin-live-page";
import { DashboardLivePage } from "./dashboard-live-page";
import { DataTable } from "./data-table";
import { FilterBar } from "./filter-bar";
import { Icon } from "@/lib/icons";
import { InventoryLivePage } from "./inventory-live-page";
import { KpiCard } from "./kpi-card";
import { MasterDataLivePage } from "./master-data-live-page";
import { MenuPricingLivePage } from "./menu-pricing-live-page";
import { OfflineSyncLivePage } from "./offline-sync-live-page";
import { PurchasingLivePage } from "./purchasing-live-page";
import { ReportsLivePage } from "./reports-live-page";
import type { Screen } from "@/lib/screens";
import { StoreOperationsExpandedPage } from "./store-operations-expanded-page";
import { TransfersLivePage } from "./transfers-live-page";

type ScreenPageProps = {
  screen: Screen;
};

export function ScreenPage({ screen }: ScreenPageProps) {
  if (screen.slug === "") {
    return <DashboardLivePage screen={screen} />;
  }

  if (screen.slug === "inventory") {
    return <InventoryLivePage screen={screen} />;
  }

  if (screen.slug === "master-data") {
    return <MasterDataLivePage screen={screen} />;
  }

  if (screen.slug === "recipes") {
    return (
      <MasterDataLivePage
        initialResource="recipes"
        lockedResource
        screen={screen}
      />
    );
  }

  if (screen.slug === "menu-pricing") {
    return <MenuPricingLivePage screen={screen} />;
  }

  if (screen.slug === "purchasing" || screen.slug === "receiving") {
    return <PurchasingLivePage screen={screen} />;
  }

  if (screen.slug === "transfers") {
    return <TransfersLivePage screen={screen} />;
  }

  if (screen.slug === "store-operations") {
    return <StoreOperationsExpandedPage screen={screen} />;
  }

  if (screen.slug === "reports") {
    return <ReportsLivePage screen={screen} />;
  }

  if (screen.slug === "offline-sync") {
    return <OfflineSyncLivePage screen={screen} />;
  }

  if (screen.slug === "admin") {
    return <AdminLivePage screen={screen} />;
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

        <div className="flex flex-wrap gap-2">
          {screen.actions.map((action) => (
            <ActionButton action={action} key={action.label} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {screen.kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      <FilterBar filters={screen.filters} />
      <DataTable
        columns={screen.table.columns}
        rows={screen.table.rows}
        title="Recent Movement Table"
      />
    </div>
  );
}
