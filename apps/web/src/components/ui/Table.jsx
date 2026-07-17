'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Table({ columns = [], rows = [], onRowClick, isLoading, emptyMessage = 'No data found', className }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sort]);

  const handleSort = useCallback((key) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  }, []);

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm orchid-scrollbar', className)}>
      <table className="min-w-full divide-y divide-slate-100">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  aria-sort={col.sortable ? (active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  className={cn(
                    'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500',
                    col.className
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-600',
                        active && 'text-slate-800'
                      )}
                    >
                      {col.label}
                      {active
                        ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100" aria-busy={isLoading || undefined}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, r) => (
              <tr key={`skel-${r}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${55 + ((r * 17 + col.key.length * 13) % 40)}%` }} />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-500">{emptyMessage}</td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'transition-colors hover:bg-slate-50',
                  onRowClick && 'cursor-pointer focus-visible:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-green-600'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3.5 text-sm text-slate-700', !col.render && 'max-w-[20rem] truncate', col.className)}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
