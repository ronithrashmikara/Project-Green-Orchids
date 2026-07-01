'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Textarea } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, TierBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminRFQDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quotePrices, setQuotePrices] = useState({});
  const [expiryDate, setExpiryDate] = useState('');
  const [sending, setSending] = useState(false);
  const [declineModal, setDeclineModal] = useState({ open: false, reason: '' });
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/rfqs/${id}`);
        const data = res.data.data || res.data;
        setRfq(data);
        const prices = {};
        (data.lines || []).forEach((l, i) => { prices[i] = l.quotedPrice || ''; });
        setQuotePrices(prices);
        setExpiryDate(data.expiresAt?.slice(0, 10) || '');
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleSendQuote = async () => {
    setSending(true);
    try {
      const items = (rfq.lines || []).map((l, i) => ({
        rfq_item_id: l.id,
        quoted_price: parseFloat(quotePrices[i]) || l.targetPrice || 0,
      }));
      await api.patch(`/rfqs/${id}/quote`, {
        items,
        quote_expiry: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      });
      toast.success('Quote sent');
      router.push('/admin/rfqs');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally { setSending(false); }
  };

  const handleDeclineSubmit = async () => {
    if (declineModal.reason.trim().length < 10) return toast.error('Reason must be at least 10 characters');
    setDeclining(true);
    try {
      await api.patch(`/rfqs/${id}/decline`, { reason: declineModal.reason });
      toast.success('Declined');
      router.push('/admin/rfqs');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally { setDeclining(false); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!rfq) return <ErrorState message="RFQ not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RFQ"
        title={`RFQ #${rfq.rfqNo || rfq.id}`}
        description="Review the request and send a quote to the buyer."
        back={{ href: '/admin/rfqs', label: 'Back to RFQs' }}
        actions={<StatusBadge status={rfq.status} />}
        tone="emerald"
      />

      {/* Buyer Context */}
      <Card>
        <h3 className="text-sm font-medium mb-2">Buyer Context</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">Name</span><p className="font-medium">{rfq.buyerName}</p></div>
          <div><span className="text-gray-500">Tier</span><p><TierBadge tier={rfq.buyerTier} /></p></div>
          <div><span className="text-gray-500">Outstanding Balance</span><p>{formatLKR(rfq.buyerBalance || 0)}</p></div>
        </div>
      </Card>

      {/* Lines */}
      {(rfq.lines || []).map((line, i) => (
        <Card key={line.id || i}>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <p className="font-medium">{line.productName || 'Product'}</p>
              <p className="text-sm text-gray-500">Requested: {line.quantity} units {line.targetPrice ? `@ ${formatLKR(line.targetPrice)}` : ''}</p>
            </div>
            <div>
              <Input
                label="Quoted Price/Unit (LKR)"
                type="number"
                step="0.01"
                value={quotePrices[i] || ''}
                onChange={(e) => setQuotePrices((p) => ({ ...p, [i]: e.target.value }))}
              />
            </div>
            <div className="text-right">
              {quotePrices[i] ? (
                <p className="font-bold text-green-700">{formatLKR(parseFloat(quotePrices[i]) * line.quantity)}</p>
              ) : null}
            </div>
          </div>
        </Card>
      ))}

      {rfq.status === 'SUBMITTED' || rfq.status === 'UNDER_REVIEW' ? (
        <Card>
          <div className="space-y-4">
            <DatePicker label="Quote Expiry Date" value={expiryDate} onChange={setExpiryDate} />
            <div className="flex justify-end gap-3">
              <Button variant="danger" onClick={() => setDeclineModal({ open: true, reason: '' })}>Decline</Button>
              <Button onClick={handleSendQuote} loading={sending}>Send Quote</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Modal open={declineModal.open} onClose={() => setDeclineModal({ open: false, reason: '' })} title="Decline RFQ" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This RFQ will be marked declined and the buyer notified.</p>
          <Textarea
            label="Reason (required, min 10 characters)"
            value={declineModal.reason}
            onChange={(e) => setDeclineModal((m) => ({ ...m, reason: e.target.value }))}
            placeholder="Explain why this request can't be fulfilled..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeclineModal({ open: false, reason: '' })}>Cancel</Button>
            <Button variant="danger" onClick={handleDeclineSubmit} loading={declining}>Decline</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
