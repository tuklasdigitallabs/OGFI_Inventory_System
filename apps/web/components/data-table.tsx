import { Icon } from '@/lib/icons';
import { StatusBadge } from './status-badge';

type DataTableProps = {
  title: string;
  columns: string[];
  rows: string[][];
};

export function DataTable({ title, columns, rows }: DataTableProps) {
  return (
    <section className="og-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-og-line p-4">
        <div className="flex items-center gap-2">
          <Icon name="Activity" size={20} className="text-og-green" />
          <h2 className="font-poppins text-xl font-semibold text-og-dark">{title}</h2>
        </div>
        <button className="rounded-md p-2 text-og-gray hover:bg-orange-50 hover:text-og-dark" type="button">
          <Icon name="MoreHorizontal" size={20} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {columns.map((column) => (
                <th className="og-table-header" key={column}>
                  <span className="inline-flex items-center gap-1">
                    {column}
                    <Icon name="ArrowUpDown" size={14} className="text-og-gray" />
                  </span>
                </th>
              ))}
              <th className="og-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-og-line hover:bg-[#fff5e4]" key={row.join('-')}>
                {row.map((cell, index) => (
                  <td className="og-table-cell" key={`${cell}-${index}`}>
                    {index === row.length - 1 ? <StatusBadge value={cell} /> : cell}
                  </td>
                ))}
                <td className="og-table-cell text-right">
                  <button className="rounded-md p-2 text-og-gray hover:bg-white hover:text-og-green" type="button">
                    <Icon name="Eye" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
