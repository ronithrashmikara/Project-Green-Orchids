'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';

export default function FinanceInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      const params = filter ? `?status=${filter}` : '';
      const res = await api.get(`/finance/invoices${params}`).catch(() => ({ data: [] }));
      setInvoices(res.data.invoices || res.data.data || res.data);
      setLoading(false);
    })();
  }, [filter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invoice Management</h1>
      <div className="flex gap-2">
        {['', 'PAID', 'UNPAID', 'PARTIAL', 'OVERDUE'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-sm rounded-full ${filter === s ? 'bg-green-700 text-white' : 'bg-gray-100'}`}>{s || 'All'}</button>
        ))}
      </div>
      {loading ? <Spinner className="py-20" /> : invoices.length === 0 ? <EmptyState title="No invoices" /> : (
        <Table
          columns={[
            { key: 'invoiceNo', label: 'Invoice #' },
            { key: 'buyerName', label: 'Buyer' },
            { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) },
            { key: 'dueDate', label: 'Due', render: (v) => formatDate(v) },
            { key: 'total', label: 'Amount', render: (v) => formatLKR(v) },
            { key: 'balance', label: 'Balance', render: (v) => formatLKR(v) },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
          ]}
          rows={invoices}
          onRowClick={(r) => router.push(`/finance/invoices/${r.id}`)}
        />
      )}
    </div>
  );
}
