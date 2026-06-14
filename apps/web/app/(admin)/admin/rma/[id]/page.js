'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Select, Textarea } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, TimelineView } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { formatDate, formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminRMADetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rma, setRma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [resolution, setResolution] = useState('');
  const [inventoryAction, setInventoryAction] = useState('return_to_stock');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/admin/rma/${id}`);
        setRma(res.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleApprove = async () => {
    setActionLoading(true);
    try { await api.post(`/admin/rma/${id}/approve`); setRma((r) => ({ ...r, status: 'APPROVED' })); toast.success('Approved'); } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const handleMarkReceived = async () => {
    setActionLoading(true);
    try { await api.post(`/admin/rma/${id}/receive`); setRma((r) => ({ ...r, status: 'RECEIVED' })); toast.success('Marked received'); } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const handleResolve = async () => {
    setActionLoading(true);
    try {
      await api.post(`/admin/rma/${id}/resolve`, { inventoryAction, resolution });
      setRma((r) => ({ ...r, status: 'RESOLVED', resolutionNotes: resolution }));
      toast.success('Resolved');
      setShowInventory(false);
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try { await api.post(`/admin/rma/${id}/reject`); setRma((r) => ({ ...r, status: 'REJECTED' })); toast.success('Rejected'); } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!rma) return <ErrorState message="RMA not found" />;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-green-700 hover:underline">&larr; Back</button>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">RMA #{rma.rmaNo || rma.id}</h1><p className="text-sm text-gray-500">Order #{rma.orderNo} &middot; {rma.buyerName}</p></div>
        <StatusBadge status={rma.status} />
      </div>

      <Card>
        <h3 className="text-sm font-medium mb-2">Details</h3>
        <p className="text-sm"><strong>Reason:</strong> {rma.reason}</p>
        <p className="text-sm"><strong>Description:</strong> {rma.description}</p>
        <ul className="text-sm mt-2 space-y-1">
          {rma.items?.map((item, i) => <li key={i}>{item.productName} × {item.quantity} {item.unitPrice ? `@ ${formatLKR(item.unitPrice)}` : ''}</li>)}
        </ul>
      </Card>

      {rma.evidence?.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium mb-2">Evidence</h3>
          <div className="flex gap-3 flex-wrap">
            {rma.evidence.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} className="w-24 h-24 object-cover rounded border hover:opacity-80" /></a>
            ))}
          </div>
        </Card>
      )}

      {/* Decision Flow */}
      <div className="flex gap-3">
        {rma.status === 'SUBMITTED' && (
          <>
            <Button variant="danger" onClick={handleReject} loading={actionLoading}>Reject</Button>
            <Button onClick={handleApprove} loading={actionLoading}>Approve</Button>
          </>
        )}
        {rma.status === 'APPROVED' && <Button onClick={handleMarkReceived} loading={actionLoading}>Mark as Received</Button>}
        {rma.status === 'RECEIVED' && <Button onClick={() => setShowInventory(true)}>Resolve & Process Inventory</Button>}
      </div>

      <Modal open={showInventory} onClose={() => setShowInventory(false)} title="Process Inventory">
        <div className="space-y-4">
          <Select label="Inventory Action" value={inventoryAction} onChange={(e) => setInventoryAction(e.target.value)} options={[
            { value: 'return_to_stock', label: 'Return to Stock' },
            { value: 'write_off', label: 'Write Off (Damaged)' },
            { value: 'quarantine', label: 'Move to Quarantine' },
          ]} />
          <Textarea label="Resolution Notes" value={resolution} onChange={(e) => setResolution(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowInventory(false)}>Cancel</Button>
            <Button onClick={handleResolve} loading={actionLoading}>Resolve</Button>
          </div>
        </div>
      </Modal>

      {rma.timeline?.length > 0 && (
        <Card><h3 className="text-sm font-medium mb-4">Timeline</h3><TimelineView events={rma.timeline} /></Card>
      )}
    </div>
  );
}
