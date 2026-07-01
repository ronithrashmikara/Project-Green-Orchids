'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Textarea } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

function normalizeRequest(r) {
  return {
    id: r.id,
    productName: r.product_name,
    oldPrice: r.current_price,
    newPrice: r.requested_price,
    requestedBy: r.requested_by_name,
    requestedAt: r.created_at,
  };
}

function normalizeHistory(r) {
  return {
    id: r.id,
    productName: r.product_name,
    oldPrice: r.old_price,
    newPrice: r.new_price,
    changedBy: r.changed_by_name,
    changedAt: r.changed_at,
    source: r.source,
  };
}

export default function PricingApprovalsPage() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, request: null, note: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    if (tab === 'pending') {
      const res = await api.get('/pricing/requests?status=PENDING').catch(() => ({ data: { data: [] } }));
      setPending((res.data.data || []).map(normalizeRequest));
    } else {
      const res = await api.get('/pricing/history').catch(() => ({ data: { data: [] } }));
      setHistory((res.data.data || []).map(normalizeHistory));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const handleApprove = async (id) => {
    try {
      await api.patch(`/pricing/requests/${id}/approve`, {});
      setPending((p) => p.filter((x) => x.id !== id));
      toast.success('Approved');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    }
  };

  const handleRejectSubmit = async () => {
    const { request, note } = rejectModal;
    if (note.trim().length < 5) return toast.error('Reason must be at least 5 characters');
    setSubmitting(true);
    try {
      await api.patch(`/pricing/requests/${request.id}/reject`, { note });
      setPending((p) => p.filter((x) => x.id !== request.id));
      toast.success('Rejected');
      setRejectModal({ open: false, request: null, note: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pricing"
        title="Pricing Approvals"
        description="Review pending price change requests and browse pricing history."
        tone="emerald"
      />
      <Tabs tabs={[{ key: 'pending', label: 'Pending', count: pending.length }, { key: 'history', label: 'History' }]} active={tab} onChange={setTab} />

      {loading ? <Spinner className="py-20" /> : (tab === 'pending' ? pending.length === 0 : history.length === 0) ? <EmptyState title="No items" /> : (
        <Table
          columns={tab === 'pending' ? [
            { key: 'productName', label: 'Product' },
            { key: 'oldPrice', label: 'Current Price', render: (v) => formatLKR(v) },
            { key: 'newPrice', label: 'Requested Price', render: (v) => formatLKR(v) },
            { key: 'requestedBy', label: 'Requested By' },
            { key: 'requestedAt', label: 'Date', render: (v) => formatDate(v) },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(r.id)}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => setRejectModal({ open: true, request: r, note: '' })}>Reject</Button>
              </div>
            )},
          ] : [
            { key: 'productName', label: 'Product' },
            { key: 'oldPrice', label: 'Old', render: (v) => v != null ? formatLKR(v) : '—' },
            { key: 'newPrice', label: 'New', render: (v) => formatLKR(v) },
            { key: 'source', label: 'Source', render: (v) => <StatusBadge status={v} /> },
            { key: 'changedBy', label: 'Changed By' },
            { key: 'changedAt', label: 'Date', render: (v) => formatDate(v) },
          ]}
          rows={tab === 'pending' ? pending : history}
        />
      )}

      <Modal open={rejectModal.open} onClose={() => setRejectModal({ open: false, request: null, note: '' })} title="Reject price change" size="sm">
        {rejectModal.request && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reject the pending price change for {rejectModal.request.productName}? The product will keep its current price.
            </p>
            <Textarea
              label="Reason (required, min 5 characters)"
              value={rejectModal.note}
              onChange={(e) => setRejectModal((m) => ({ ...m, note: e.target.value }))}
              placeholder="Why is this being rejected?"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectModal({ open: false, request: null, note: '' })}>Cancel</Button>
              <Button variant="danger" onClick={handleRejectSubmit} loading={submitting}>Reject</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
