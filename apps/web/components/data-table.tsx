"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";
import { StatusBadge } from "./status-badge";

type DataTableProps = {
  title: string;
  columns: string[];
  rows: string[][];
  emptyMessage?: string;
  error?: string | null;
  loading?: boolean;
};

export function DataTable({
  title,
  columns,
  rows,
  emptyMessage = 'No records found',
  error,
  loading = false,
}: DataTableProps) {
  const stateColSpan = columns.length + 1;
  const [selectedRow, setSelectedRow] = useState<string[] | null>(null);

  return (
    <section className="og-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-og-line p-4">
        <div className="flex items-center gap-2">
          <Icon name="Activity" size={20} className="text-og-green" />
          <h2 className="font-poppins text-xl font-semibold text-og-dark">
            {title}
          </h2>
        </div>
        <button
          className="rounded-md p-2 text-og-gray hover:bg-orange-50 hover:text-og-dark"
          type="button"
        >
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
                    <Icon
                      name="ArrowUpDown"
                      size={14}
                      className="text-og-gray"
                    />
                  </span>
                </th>
              ))}
              <th className="og-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t border-og-line">
                <td
                  className="og-table-cell py-8 text-center text-og-gray"
                  colSpan={stateColSpan}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon
                      name="RefreshCw"
                      size={16}
                      className="animate-spin text-og-green"
                    />
                    Loading records
                  </span>
                </td>
              </tr>
            ) : null}

            {!loading && error ? (
              <tr className="border-t border-og-line">
                <td
                  className="og-table-cell py-8 text-center font-semibold text-og-error"
                  colSpan={stateColSpan}
                >
                  {error}
                </td>
              </tr>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <tr className="border-t border-og-line">
                <td
                  className="og-table-cell py-8 text-center text-og-gray"
                  colSpan={stateColSpan}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : null}

            {!loading && !error
              ? rows.map((row, rowIndex) => (
                  <tr
                    className="border-t border-og-line hover:bg-[#fff5e4]"
                    key={`${row.join("-")}-${rowIndex}`}
                  >
                    {row.map((cell, index) => (
                      <td className="og-table-cell" key={`${cell}-${index}`}>
                        {index === row.length - 1 ? (
                          <StatusBadge value={cell} />
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                    <td className="og-table-cell text-right">
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-white hover:text-og-green"
                        aria-label={`View ${row[3] ?? row[0]}`}
                        type="button"
                        onClick={() => setSelectedRow(row)}
                      >
                        <Icon name="Eye" size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <section className="w-full max-w-lg rounded-md border border-og-line bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-og-line px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-og-gray">
                  Row Details
                </p>
                <h3 className="font-poppins text-lg font-semibold text-og-dark">
                  {selectedRow[3] ?? selectedRow[0]}
                </h3>
              </div>
              <button
                className="rounded-md p-2 text-og-gray hover:bg-orange-50 hover:text-og-dark"
                type="button"
                onClick={() => setSelectedRow(null)}
              >
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="divide-y divide-og-line">
              {columns.map((column, index) => (
                <div
                  className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-3 text-sm"
                  key={column}
                >
                  <span className="font-semibold text-og-gray">{column}</span>
                  <span className="font-medium text-og-dark">
                    {index === selectedRow.length - 1 ? (
                      <StatusBadge value={selectedRow[index]} />
                    ) : (
                      selectedRow[index]
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
