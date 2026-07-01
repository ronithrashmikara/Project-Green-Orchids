'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export default function AdminRFQsPage() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      const params = filter ? `?status=${filter}` : '';
      const res = await api.get(`/rfqs${params}`).catch(() => ({ data: { data: [] } }));
      const rows = (res.data.data || []).map((r) => ({
        id: r.id,
        rfqNo: r.rfq_no,
        buyerName: r.buyer_name,
        createdAt: r.created_at,
        status: r.status,
      }));
      setRfqs(rows);
      setLoading(false);
    })();
  }, [filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RFQs"
        title="RFQ Management"
        description="Review and quote buyer requests for quotation."
        tone="emerald"
      />
      <div className="flex gap-2">
        {['', 'SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'CONVERTED', 'DECLINED', 'REJECTED', 'EXPIRED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-sm rounded-full ${filter === s ? 'bg-green-700 text-white' : 'bg-gray-100'}`}>{s || 'All'}</button>
        ))}
      </div>
      {loading ? <Spinner className="py-20" /> : rfqs.length === 0 ? <EmptyState title="No RFQs" /> : (
        <Table
          columns={[
            { key: 'rfqNo', label: 'RFQ #', render: (v, r) => v || r.id },
            { key: 'buyerName', label: 'Buyer' },
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
