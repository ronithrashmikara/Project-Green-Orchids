'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { PageHeader } from '@/components/domain/DashboardUI';
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
  const [reverseReason, setReverseReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadInvoice = async () => {
    const res = await api.get(`/invoices/${id}`);
    const inv = res.data.data || res.data;
    setInvoice({
      ...inv,
      invoiceNo: inv.invoice_no, buyerName: inv.buyer_name, createdAt: inv.created_at,
      total: Number(inv.total_amount), totalPaid: Number(inv.paid_amount || 0), balance: Number(inv.balance_due),
      payments: (inv.payments || []).map((p) => ({ id: p.id, date: p.received_at, method: p.method, reference: p.reference, amount: Number(p.amount) })),
    });
  };

  useEffect(() => {
    (async () => {
      try { await loadInvoice(); } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleRecordPayment = async () => {
    setActionLoading(true);
    try {
      await api.post('/payments', { invoice_id: Number(id), amount: Number(paymentForm.amount), method: paymentForm.method, reference: paymentForm.reference || undefined });
      toast.success('Payment recorded');
      setShowPayment(false);
      await loadInvoice();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); } finally { setActionLoading(false); }
  };

  const handleReversePayment = async () => {
    if (reverseReason.trim().length < 10) { toast.error('Reason must be at least 10 characters'); return; }
    setActionLoading(true);
    try {
      await api.post(`/payments/${reverseId}/reverse`, { reason: reverseReason });
      toast.success('Payment reversed');
      setShowReverse(false);
      setReverseReason('');
      await loadInvoice();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); } finally { setActionLoading(false); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!invoice) return <ErrorState message="Invoice not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        tone="sky"
        back={{ href: '/finance/invoices', label: 'Back' }}
        title={`Invoice #${invoice.invoiceNo || invoice.id}`}
        description={`${invoice.buyerName} · ${formatDate(invoice.createdAt)}`}
        actions={<StatusBadge status={invoice.status} />}
      />

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
          <Input label="Reason for reversal" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="At least 10 characters" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowReverse(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleReversePayment} loading={actionLoading}>Reverse Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
