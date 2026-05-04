import { ActionButton } from './action-button';
import { DataTable } from './data-table';
import { FilterBar } from './filter-bar';
import { Icon } from '@/lib/icons';
import { KpiCard } from './kpi-card';
import type { Screen } from '@/lib/screens';

type ScreenPageProps = {
  screen: Screen;
};

export function ScreenPage({ screen }: ScreenPageProps) {
  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-green-50 p-3 text-og-green">
            <Icon name={screen.icon} size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-og-gray">{screen.eyebrow}</p>
            <h1 className="font-poppins text-2xl font-semibold text-og-dark sm:text-[28px]">{screen.title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-og-gray">{screen.description}</p>
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
      <DataTable columns={screen.table.columns} rows={screen.table.rows} title="Recent Movement Table" />
    </div>
  );
}
