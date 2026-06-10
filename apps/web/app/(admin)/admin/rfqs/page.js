'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { StatusBadge, TierBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate, formatLKR } from '@/lib/utils';

export default function AdminRFQsPage() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      const params = filter ? `?status=${filter}` : '';
      const res = await api.get(`/admin/rfqs${params}`).catch(() => ({ data: [] }));
      setRfqs(res.data.rfqs || res.data.data || res.data);
      setLoading(false);
    })();
  }, [filter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">RFQ Management</h1>
      <div className="flex gap-2">
        {['', 'SUBMITTED', 'QUOTED', 'ACCEPTED', 'DECLINED', 'EXPIRED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-sm rounded-full ${filter === s ? 'bg-green-700 text-white' : 'bg-gray-100'}`}>{s || 'All'}</button>
        ))}
      </div>
      {loading ? <Spinner className="py-20" /> : rfqs.length === 0 ? <EmptyState title="No RFQs" /> : (
        <Table
          columns={[
            { key: 'rfqNo', label: 'RFQ #', render: (v, r) => v || r.id },
            { key: 'buyerName', label: 'Buyer' },
            { key: 'items', label: 'Items', render: (v) => v?.length || '-' },
            { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
          ]}
          rows={rfqs}
          onRowClick={(r) => router.push(`/admin/rfqs/${r.id}`)}
        />
      )}
    </div>
  );
}
