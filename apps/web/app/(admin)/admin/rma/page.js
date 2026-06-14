'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export default function AdminRMAPage() {
  const router = useRouter();
  const [rmas, setRmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      const params = filter ? `?status=${filter}` : '';
      const res = await api.get(`/admin/rma${params}`).catch(() => ({ data: [] }));
      setRmas(res.data.rmas || res.data.data || res.data);
      setLoading(false);
    })();
  }, [filter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">RMA Management</h1>
      <div className="flex gap-2">
        {['', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'RESOLVED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-sm rounded-full ${filter === s ? 'bg-green-700 text-white' : 'bg-gray-100'}`}>{s || 'All'}</button>
        ))}
      </div>
      {loading ? <Spinner className="py-20" /> : rmas.length === 0 ? <EmptyState title="No RMAs" /> : (
        <Table
          columns={[
            { key: 'rmaNo', label: 'RMA #' },
            { key: 'orderNo', label: 'Order' },
            { key: 'buyerName', label: 'Buyer' },
            { key: 'reason', label: 'Reason' },
            { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
          ]}
          rows={rmas}
          onRowClick={(r) => router.push(`/admin/rma/${r.id}`)}
        />
      )}
    </div>
  );
}
