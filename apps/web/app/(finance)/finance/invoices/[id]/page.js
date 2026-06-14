'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function FinanceInvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'BANK_TRANSFER', reference: '' });
  const [reverseId, setReverseId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/finance/invoices/${id}`);
        setInvoice(res.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleRecordPayment = async () => {
    setActionLoading(true);
    try {
      await api.post(`/finance/invoices/${id}/payments`, paymentForm);
      toast.success('Payment recorded');
      setShowPayment(false);
      const res = await api.get(`/finance/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setActionLoading(false); }
  };

  const handleReversePayment = async () => {
    if (!confirm('Reverse this payment? This requires two-person confirmation.')) return;
    setActionLoading(true);
    try {
      await api.post(`/finance/invoices/${id}/payments/${reverseId}/reverse`);
      toast.success('Payment reversed');
      setShowReverse(false);
      const res = await api.get(`/finance/invoices/${id}`);
      setInvoice(res.data);
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!invoice) return <ErrorState message="Invoice not found" />;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-green-700 hover:underline">&larr; Back</button>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Invoice #{invoice.invoiceNo || invoice.id}</h1><p className="text-sm text-gray-500">{invoice.buyerName} &middot; {formatDate(invoice.createdAt)}</p></div>
        <StatusBadge status={invoice.status} />
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Subtotal</span><p className="font-medium">{formatLKR(invoice.subtotal)}</p></div>
          <div><span className="text-gray-500">Tax</span><p className="font-medium">{formatLKR(invoice.tax || 0)}</p></div>
          <div><span className="text-gray-500 font-semibold">Total</span><p className="font-bold text-lg">{formatLKR(invoice.total)}</p></div>
          <div><span className="text-gray-500">Paid</span><p className="text-green-700 font-medium">{formatLKR(invoice.totalPaid || 0)}</p></div>
          <div><span className="text-gray-500 font-semibold">Balance</span><p className="font-bold">{formatLKR(invoice.balance)}</p></div>
        </div>
      </Card>

      {invoice.payments?.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium mb-3">Payment History</h3>
          {invoice.payments.map((p, i) => (
            <div key={i} className="flex justify-between items-center text-sm py-2 border-b last:border-b-0">
              <div><span>{formatDate(p.date)}</span><span className="ml-3 text-gray-500">{p.method}</span><span className="ml-2 text-gray-400">{p.reference}</span></div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatLKR(p.amount)}</span>
                <button onClick={() => { setReverseId(p.id); setShowReverse(true); }} className="text-red-500 text-xs hover:underline">Reverse</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="flex gap-3">
        <Button onClick={() => { setPaymentForm({ amount: String(invoice.balance || 0), method: 'BANK_TRANSFER', reference: '' }); setShowPayment(true); }}>Record Payment</Button>
      </div>

      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Record Payment">
        <div className="space-y-4">
          <Input label="Amount (LKR)" type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} />
          <select value={paymentForm.method} onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))} className="w-full px-3 py-2 border rounded text-sm">
            <option value="BANK_TRANSFER">Bank Transfer</option><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option><option value="ONLINE">Online Payment</option>
          </select>
          <Input label="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} loading={actionLoading}>Record</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showReverse} onClose={() => setShowReverse(false)} title="Reverse Payment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This action requires two-person confirmation. Are you sure you want to reverse this payment?</p>
          <Input label="Reason for reversal" value={''} onChange={() => {}} placeholder="Required" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowReverse(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleReversePayment} loading={actionLoading}>Reverse Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
