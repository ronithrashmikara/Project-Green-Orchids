'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchSalesQueue, isMine, isUnassigned } from '@/lib/sales';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Table } from '@/components/ui/Table';
import { Button, Textarea } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

function normalizeApproval(a) {
  return {
    id: a.id,
    orderNo: a.order_no || a.orderNumber || a.id,
    buyerName: a.buyer_name || a.buyerName || a.buyer?.businessName || '—',
    total: Number(a.total || a.totalAmount || 0),
    status: a.status || 'PENDING_APPROVAL',
    assignedTo: a.assigned_to ?? a.assignedTo ?? null,
    assignedToName: a.assigned_to_name || a.assignedToName || null,
    createdAt: a.created_at || a.createdAt,
    raw: a,
  };
}

export default function SalesApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectModal, setRejectModal] = useState({ open: false, order: null, reason: '' });
  const [detailModal, setDetailModal] = useState({ open: false, order: null, detail: null, loading: false });

  const queueQuery = useQuery({ queryKey: ['sales', 'queue'], queryFn: fetchSalesQueue });

  const invalidateQueue = () => queryClient.invalidateQueries({ queryKey: ['sales', 'queue'] });

  const claimMutation = useMutation({
    mutationFn: (orderId) => api.patch(`/orders/${orderId}/claim`, {}),
    onSuccess: () => { toast.success('Order claimed'); invalidateQueue(); },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to claim order'),
  });

  const approveMutation = useMutation({
    mutationFn: (orderId) => api.patch(`/orders/${orderId}/approve`, {}),
    onSuccess: () => { toast.success('Order approved'); invalidateQueue(); },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to approve order'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }) => api.patch(`/orders/${orderId}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Order rejected');
      setRejectModal({ open: false, order: null, reason: '' });
      invalidateQueue();
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to reject order'),
  });

  const openDetail = async (row) => {
    setDetailModal({ open: true, order: row, detail: null, loading: true });
    try {
      const res = await api.get(`/orders/${row.id}`);
      setDetailModal((m) => ({ ...m, detail: res.data.data || res.data.order || res.data, loading: false }));
    } catch {
      setDetailModal((m) => ({ ...m, loading: false }));
    }
  };

  const handleReject = () => {
    if (rejectModal.reason.trim().length < 10) return toast.error('Reason must be at least 10 characters');
    rejectMutation.mutate({ orderId: rejectModal.order.id, reason: rejectModal.reason });
  };

  if (queueQuery.isLoading) return <Spinner className="py-20" />;

  const approvals = (queueQuery.data?.approvals || []).map(normalizeApproval);

  const columns = [
    { key: 'orderNo', label: 'Order #', render: (v) => <span className="font-mono text-xs font-semibold text-slate-800">#{v}</span> },
    { key: 'buyerName', label: 'Buyer' },
    { key: 'total', label: 'Total', render: (v) => <span className="font-semibold text-emerald-600">{formatLKR(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'assignedToName', label: 'Assigned to', render: (v, r) => (
      r.assignedTo
        ? <span className={isMine(r.raw, user?.id) ? 'font-semibold text-slate-800' : 'text-slate-600'}>
            {isMine(r.raw, user?.id) ? 'You' : (v || `#${r.assignedTo}`)}
          </span>
        : <span className="text-slate-400">Unassigned</span>
    )},
    { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) },
    { key: 'actions', label: '', className: 'text-right', render: (_, r) => (
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" onClick={() => openDetail(r)}>View</Button>
        {isUnassigned(r.raw) && (
          <Button size="sm" variant="outline" loading={claimMutation.isPending && claimMutation.variables === r.id}
            onClick={() => claimMutation.mutate(r.id)}>
            Claim
          </Button>
        )}
        <Button size="sm" loading={approveMutation.isPending && approveMutation.variables === r.id}
          onClick={() => approveMutation.mutate(r.id)}>
          Approve
        </Button>
        <Button size="sm" variant="danger" onClick={() => setRejectModal({ open: true, order: r, reason: '' })}>
          Reject
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        tone="emerald"
        title="Order approvals"
        description="Pending trade orders assigned to you, plus unassigned orders you can claim."
      />

      {queueQuery.isError && <ErrorState message={queueQuery.error?.message} onRetry={() => queueQuery.refetch()} />}
      {!queueQuery.isError && (approvals.length === 0
        ? <EmptyState title="No pending approvals" description="New orders awaiting approval will appear here." />
        : <Table columns={columns} rows={approvals} />)}

      {/* Order detail modal */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, order: null, detail: null, loading: false })}
        title={detailModal.order ? `Order #${detailModal.order.orderNo}` : 'Order detail'}
      >
        {detailModal.loading ? <Spinner className="py-10" /> : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Buyer</p>
                <p className="font-medium text-slate-800">{detailModal.detail?.buyer_name || detailModal.order?.buyerName || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
                <StatusBadge status={detailModal.detail?.status || detailModal.order?.status} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
                <p className="font-semibold text-emerald-600">{formatLKR(detailModal.detail?.total || detailModal.order?.total || 0)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Placed</p>
                <p className="text-slate-600">{formatDate(detailModal.detail?.created_at || detailModal.order?.createdAt)}</p>
              </div>
            </div>

            {(detailModal.detail?.items || []).length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Product', 'Qty', 'Unit price'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailModal.detail.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="px-3 py-2 text-slate-700">{item.product_name || item.productName || item.product?.name || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{item.qty || item.quantity}</td>
                        <td className="px-3 py-2 text-slate-600">{formatLKR(item.unit_price || item.unitPrice || item.price || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDetailModal({ open: false, order: null, detail: null, loading: false })}>Close</Button>
              <Button
                loading={approveMutation.isPending}
                onClick={() => {
                  approveMutation.mutate(detailModal.order.id, {
                    onSuccess: () => setDetailModal({ open: false, order: null, detail: null, loading: false }),
                  });
                }}
              >
                Approve order
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject modal */}
      <Modal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, order: null, reason: '' })}
        title="Reject order"
        size="sm"
      >
        {rejectModal.order && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Reject order <span className="font-semibold">#{rejectModal.order.orderNo}</span>? The buyer will be notified with your reason.
            </p>
            <Textarea
              label="Reason (required, min 10 characters)"
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((m) => ({ ...m, reason: e.target.value }))}
              placeholder="Why is this order being rejected?"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectModal({ open: false, order: null, reason: '' })}>Cancel</Button>
              <Button variant="danger" onClick={handleReject} loading={rejectMutation.isPending}>Reject order</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
