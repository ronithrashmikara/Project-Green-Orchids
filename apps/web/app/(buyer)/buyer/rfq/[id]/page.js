'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge, TimelineView } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function RFQDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // 'accept' | 'reject' | null

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/rfqs/${id}`);
        setRfq(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleAccept = async () => {
    try {
      await api.post(`/rfqs/${id}/accept`);
      toast.success('Quote accepted');
      setRfq((r) => ({ ...r, status: 'ACCEPTED' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept');
    }
  };

  const handleReject = async () => {
    try {
      await api.post(`/rfqs/${id}/reject`);
      toast.success('Quote rejected');
      setRfq((r) => ({ ...r, status: 'REJECTED' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!rfq) return <ErrorState message="RFQ not found" />;

  const isExpired = rfq.status === 'EXPIRED' || (rfq.status === 'QUOTED' && rfq.expiresAt && new Date(rfq.expiresAt) < new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        back={{ href: '/buyer/rfq', label: 'Back' }}
        title={`RFQ #${rfq.rfqNo || rfq.id}`}
        description={`Submitted: ${formatDate(rfq.createdAt)}`}
        actions={<StatusBadge status={rfq.status} />}
      />

      {/* Quote */}
      {rfq.quotedAt && !isExpired && !['EXPIRED', 'ACCEPTED', 'REJECTED'].includes(rfq.status) && (
        <div className="bg-orange-50 p-4 rounded-lg text-sm">
          ⏰ Quote expires: <strong>{formatDate(rfq.expiresAt)}</strong>
        </div>
      )}

      {isExpired && rfq.status !== 'ACCEPTED' && (
        <div className="bg-gray-100 p-4 rounded-lg text-sm text-gray-600">
          This quote has expired. Please submit a new RFQ for updated pricing.
        </div>
      )}

      {/* Quote Table */}
      {rfq.lines?.map((line, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{line.productName || line.productId}</h4>
              <p className="text-sm text-gray-500">Requested: {line.quantity} units</p>
              {line.targetPrice && <p className="text-xs text-gray-400">Target: {formatLKR(line.targetPrice)}/unit</p>}
            </div>
            <div className="text-right">
              {line.quotedPrice ? (
                <>
                  <p className="text-sm text-gray-500">{formatLKR(line.quotedPrice)}/unit</p>
                  <p className="font-bold text-green-700">{formatLKR(line.quotedPrice * line.quantity)}</p>
                </>
              ) : (
                <span className="text-sm text-gray-400">Awaiting quote</span>
              )}
            </div>
          </div>
        </Card>
      ))}

      {rfq.status === 'QUOTED' && !isExpired && (
        <div className="flex justify-end gap-3">
          <Button variant="danger" onClick={() => setConfirmAction('reject')}>Reject Quote</Button>
          <Button onClick={() => setConfirmAction('accept')}>Accept Quote</Button>
        </div>
      )}

      {/* Timeline */}
      {rfq.timeline?.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium mb-4">Timeline</h3>
          <TimelineView events={rfq.timeline} />
        </Card>
      )}

      <ConfirmDialog
        open={confirmAction === 'accept'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAccept}
        title="Accept quote"
        message="Accept this quote and place the order at the quoted prices? This commits you to purchase."
        confirmLabel="Accept quote"
        variant="info"
      />
      <ConfirmDialog
        open={confirmAction === 'reject'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleReject}
        title="Reject quote"
        message="Reject this quote? You'll need to submit a new RFQ if you change your mind."
        confirmLabel="Reject quote"
        variant="danger"
      />
    </div>
  );
}
