'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { StatusBadge, TierBadge } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminRFQDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quotePrices, setQuotePrices] = useState({});
  const [expiryDate, setExpiryDate] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/admin/rfqs/${id}`);
        setRfq(res.data);
        // Init quote prices
        const prices = {};
        (res.data.lines || []).forEach((l, i) => { prices[i] = l.quotedPrice || ''; });
        setQuotePrices(prices);
        setExpiryDate(res.data.expiresAt?.slice(0, 10) || '');
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleSendQuote = async () => {
    setSending(true);
    try {
      const lines = (rfq.lines || []).map((l, i) => ({
        lineId: l.id || i,
        quotedPrice: parseFloat(quotePrices[i]) || l.targetPrice || 0,
      }));
      await api.post(`/admin/rfqs/${id}/quote`, { lines, expiresAt: expiryDate });
      toast.success('Quote sent');
      router.push('/admin/rfqs');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSending(false); }
  };

  const handleDecline = async () => {
    try {
      await api.post(`/admin/rfqs/${id}/decline`);
      toast.success('Declined');
      router.push('/admin/rfqs');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!rfq) return <ErrorState message="RFQ not found" />;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-green-700 hover:underline">&larr; Back</button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">RFQ #{rfq.rfqNo || rfq.id}</h1>
        <StatusBadge status={rfq.status} />
      </div>

      {/* Buyer Context */}
      <Card>
        <h3 className="text-sm font-medium mb-2">Buyer Context</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Name</span><p className="font-medium">{rfq.buyerName}</p></div>
          <div><span className="text-gray-500">Tier</span><p><TierBadge tier={rfq.buyerTier} /></p></div>
          <div><span className="text-gray-500">Reliability</span><p>{rfq.buyerReliability ?? 'N/A'}</p></div>
          <div><span className="text-gray-500">Balance</span><p>{formatLKR(rfq.buyerBalance || 0)}</p></div>
        </div>
      </Card>

      {/* Lines */}
      {(rfq.lines || []).map((line, i) => (
        <Card key={i}>
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

      {rfq.status === 'SUBMITTED' && (
        <Card>
          <div className="space-y-4">
            <DatePicker label="Quote Expiry Date" value={expiryDate} onChange={setExpiryDate} />
            <div className="flex justify-end gap-3">
              <Button variant="danger" onClick={handleDecline}>Decline</Button>
              <Button onClick={handleSendQuote} loading={sending}>Send Quote</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
