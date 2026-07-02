'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Button, Select, Textarea } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminRMADetailPage() {
  const { id } = useParams();
  const [rma, setRma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceive, setShowReceive] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [disposition, setDisposition] = useState('RESTOCK');
  const [resolution, setResolution] = useState('REFUND');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/rma/${id}`);
      setRma(res.data.data || res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleApprove = async () => {
    setActionLoading(true);
    try { await api.patch(`/rma/${id}/approve`); toast.success('Approved'); load(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleReceive = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/rma/${id}/receive`, { disposition, notes: notes || undefined });
      toast.success('Marked received');
      setShowReceive(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleResolve = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/rma/${id}/resolve`, {
        resolution,
        adjustment_amount: adjustmentAmount ? Number(adjustmentAmount) : undefined,
        notes: notes || undefined,
      });
      toast.success('Resolved');
      setShowResolve(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (rejectReason.trim().length < 10) return toast.error('Reason must be at least 10 characters');
    setActionLoading(true);
    try {
      await api.patch(`/rma/${id}/reject`, { reason: rejectReason });
      toast.success('Rejected');
      setConfirmReject(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!rma) return <ErrorState message="RMA not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RMA"
        title={`RMA #${rma.rma_no || rma.id}`}
        description={`Order #${rma.order_no || rma.order_id} · ${rma.buyer_name}`}
        back={{ href: '/admin/rma', label: 'Back to RMAs' }}
        actions={<StatusBadge status={rma.status} />}
        tone="emerald"
      />

      <Card>
        <h3 className="text-sm font-medium mb-2">Details</h3>
        <p className="text-sm"><strong>Category:</strong> {rma.reason_category}</p>
        <p className="text-sm"><strong>Description:</strong> {rma.reason_detail}</p>
        <ul className="text-sm mt-2 space-y-1">
          {rma.items?.map((item, i) => <li key={i}>{item.product_name} × {item.qty} {item.unit_price_at_order ? `@ ${formatLKR(item.unit_price_at_order)}` : ''}</li>)}
        </ul>
        {rma.resolution && <p className="text-sm mt-2"><strong>Resolution note:</strong> {rma.resolution}</p>}
      </Card>

      <div className="flex gap-3">
        {rma.status === 'PENDING' && (
          <>
            <Button variant="danger" onClick={() => setConfirmReject(true)} loading={actionLoading}>Reject</Button>
            <Button onClick={handleApprove} loading={actionLoading}>Approve</Button>
          </>
        )}
        {rma.status === 'APPROVED' && <Button onClick={() => setShowReceive(true)}>Mark as Received</Button>}
        {(rma.status === 'ITEM_RECEIVED' || rma.status === 'APPROVED') && <Button variant="outline" onClick={() => setShowResolve(true)}>Resolve</Button>}
      </div>

      <Modal open={showReceive} onClose={() => setShowReceive(false)} title="Mark Item Received">
        <div className="space-y-4">
          <Select label="Disposition" value={disposition} onChange={(e) => setDisposition(e.target.value)} options={[
            { value: 'RESTOCK', label: 'Return to Stock' },
            { value: 'WRITE_OFF', label: 'Write Off (Damaged)' },
          ]} />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowReceive(false)}>Cancel</Button>
            <Button onClick={handleReceive} loading={actionLoading}>Confirm Received</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showResolve} onClose={() => setShowResolve(false)} title="Resolve Return">
        <div className="space-y-4">
          <Select label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} options={[
            { value: 'REFUND', label: 'Refund' },
            { value: 'CREDIT_NOTE', label: 'Credit Note' },
            { value: 'REPLACEMENT', label: 'Replacement' },
            { value: 'OTHER', label: 'Other' },
          ]} />
          {(resolution === 'REFUND' || resolution === 'CREDIT_NOTE') && (
            <input type="number" placeholder="Adjustment amount (LKR)" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
          )}
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button>
            <Button onClick={handleResolve} loading={actionLoading}>Resolve</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmReject} onClose={() => setConfirmReject(false)} title="Reject return request" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Reject this RMA? The buyer will be notified and no refund or exchange will be processed.</p>
          <Textarea label="Reason (required, min 10 characters)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmReject(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleReject} loading={actionLoading}>Reject RMA</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
