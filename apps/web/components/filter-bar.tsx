import { Icon } from '@/lib/icons';

type FilterBarProps = {
  filters: string[];
};

export function FilterBar({ filters }: FilterBarProps) {
  return (
    <section className="og-card">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-xs font-semibold text-og-gray">Search</span>
          <span className="flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 focus-within:border-og-green">
            <Icon name="Search" size={18} className="text-og-gray" />
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              placeholder="Search records"
              type="search"
            />
          </span>
        </label>

        {filters.map((filter) => (
          <label className="min-w-[160px]" key={filter}>
            <span className="mb-1 block text-xs font-semibold text-og-gray">{filter}</span>
            <select className="h-10 w-full rounded-md border border-og-line bg-white px-3 text-sm focus:border-og-green">
              <option>All</option>
              <option>Needs action</option>
              <option>Posted</option>
            </select>
          </label>
        ))}

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-og-line bg-white px-3 text-sm font-semibold text-og-dark hover:border-og-green hover:text-og-green"
          type="button"
        >
          <Icon name="Filter" size={18} />
          Apply
        </button>
      </div>
    </section>
  );
}
