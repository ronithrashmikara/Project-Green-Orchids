'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function PricingApprovalsPage() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ product: '', dateFrom: '', dateTo: '' });

  useEffect(() => {
    setLoading(true);
    (async () => {
      if (tab === 'pending') {
        const res = await api.get('/admin/pricing/approvals').catch(() => ({ data: [] }));
        setPending(res.data.approvals || res.data.data || res.data);
      } else {
        const params = new URLSearchParams();
        if (filters.product) params.set('product', filters.product);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        const res = await api.get(`/admin/pricing/history?${params}`).catch(() => ({ data: [] }));
        setHistory(res.data.history || res.data.data || res.data);
      }
      setLoading(false);
    })();
  }, [tab, filters]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/admin/pricing/approvals/${id}/approve`);
      setPending((p) => p.filter((x) => x.id !== id));
      toast.success('Approved');
    } catch { toast.error('Failed'); }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/admin/pricing/approvals/${id}/reject`);
      setPending((p) => p.filter((x) => x.id !== id));
      toast.success('Rejected');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing Approvals</h1>
      <Tabs tabs={[{ key: 'pending', label: 'Pending', count: pending.length }, { key: 'history', label: 'History' }]} active={tab} onChange={setTab} />

      {tab === 'history' && (
        <div className="flex gap-3">
          <input type="text" placeholder="Product" value={filters.product} onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value }))} className="px-3 py-2 border rounded text-sm" />
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="px-3 py-2 border rounded text-sm" />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} className="px-3 py-2 border rounded text-sm" />
        </div>
      )}

      {loading ? <Spinner className="py-20" /> : (tab === 'pending' ? pending.length === 0 : history.length === 0) ? <EmptyState title="No items" /> : (
        <Table
          columns={tab === 'pending' ? [
            { key: 'productName', label: 'Product' },
            { key: 'oldPrice', label: 'Old Price', render: (v) => formatLKR(v) },
            { key: 'newPrice', label: 'New Price', render: (v) => formatLKR(v) },
            { key: 'requestedBy', label: 'Requested By' },
            { key: 'requestedAt', label: 'Date', render: (v) => formatDate(v) },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(r.id)}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => handleReject(r.id)}>Reject</Button>
              </div>
            )},
          ] : [
            { key: 'productName', label: 'Product' },
            { key: 'oldPrice', label: 'Old', render: (v) => formatLKR(v) },
            { key: 'newPrice', label: 'New', render: (v) => formatLKR(v) },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'resolvedAt', label: 'Resolved', render: (v) => formatDate(v) },
          ]}
          rows={tab === 'pending' ? pending : history}
        />
      )}
    </div>
  );
}
