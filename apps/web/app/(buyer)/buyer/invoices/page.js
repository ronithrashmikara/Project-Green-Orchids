'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatLKR, formatDate } from '@/lib/utils';

function normalizeInvoice(inv) {
  return {
    ...inv,
    invoiceNo: inv.invoice_no || inv.invoiceNo,
    createdAt: inv.created_at || inv.createdAt,
    dueDate: inv.due_date || inv.dueDate,
    total: Number(inv.total_amount ?? inv.total ?? 0),
    balance: Number(inv.balance_due ?? inv.balance ?? 0),
  };
}

export default function InvoicesListPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const params = filter ? `?status=${filter}` : '';
        const res = await api.get(`/invoices${params}`);
        const rows = res.data.invoices || res.data.data || res.data;
        setInvoices((Array.isArray(rows) ? rows : []).map(normalizeInvoice));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  const columns = [
    { key: 'invoiceNo', label: 'Invoice #', render: (v, r) => v || r.id },
    { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) },
    { key: 'dueDate', label: 'Due', render: (v) => formatDate(v) },
    { key: 'total', label: 'Amount', render: (v) => formatLKR(v) },
    { key: 'balance', label: 'Balance', render: (v) => formatLKR(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader tone="violet" title="Invoices" description="View and manage your invoices and payment status." />
      <div className="flex gap-2">
        {['', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-sm rounded-full ${filter === s ? 'bg-green-700 text-white' : 'bg-gray-100'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>
      {error && <ErrorState message={error} />}
      {loading ? <Spinner className="py-20" /> : invoices.length === 0 ? <EmptyState title="No invoices found" /> : (
        <Table columns={columns} rows={invoices} onRowClick={(r) => router.push(`/buyer/invoices/${r.id}`)} />
      )}
    </div>
  );
}
