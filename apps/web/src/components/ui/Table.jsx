'use client';

import { useState, useCallback, useMemo } from 'react';
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
    <div className={cn('overflow-x-auto rounded-3xl border border-white/70 bg-white/85 shadow-card ring-1 ring-slate-900/5 backdrop-blur-xl orchid-scrollbar', className)}>
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-gradient-to-r from-green-50 via-white to-orchid-50/60">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500',
                  col.sortable && 'cursor-pointer select-none hover:text-green-700',
                  col.className
                )}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                {col.label}
                {col.sortable && sort.key === col.key && <span className="ml-1 text-green-600">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-[3px] border-green-500 border-t-transparent" />
              </td>
            </tr>
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm font-medium text-slate-500">{emptyMessage}</td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={cn('transition-colors hover:bg-green-50/50', onRowClick && 'cursor-pointer')}
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
