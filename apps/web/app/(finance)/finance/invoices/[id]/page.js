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
  const [reversePayment, setReversePayment] = useState(null);
  const [reverseForm, setReverseForm] = useState({ reason: '', officerEmail: '', officerPassword: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const loadInvoice = async () => {
    const res = await api.get(`/invoices/${id}`);
    const inv = res.data.data || res.data;
    setInvoice({
      ...inv,
      invoiceNo: inv.invoice_no, buyerName: inv.buyer_name, createdAt: inv.created_at,
      total: Number(inv.total_amount), totalPaid: Number(inv.paid_amount || 0), balance: Number(inv.balance_due),
      payments: (inv.payments || []).map((p) => ({ id: p.id, date: p.received_at, method: p.method, reference: p.reference, amount: Number(p.amount), reversed: !!p.reversed_at })),
    });
  };

  useEffect(() => {
    (async () => {
      try { await loadInvoice(); } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleRecordPayment = async () => {
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter a valid payment amount');
    if (amount > Number(invoice.balance)) return toast.error('Amount cannot exceed the invoice balance');
    setActionLoading(true);
    try {
      await api.post('/payments', { invoice_id: Number(id), amount, method: paymentForm.method, reference: paymentForm.reference || undefined });
      toast.success('Payment recorded');
      setShowPayment(false);
      await loadInvoice();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); } finally { setActionLoading(false); }
  };

  const handleReversePayment = async () => {
    if (reverseForm.reason.trim().length < 10) { toast.error('Reason must be at least 10 characters'); return; }
    const needsConfirmation = reversePayment && reversePayment.amount > 50000;
    if (needsConfirmation && (!reverseForm.officerEmail || !reverseForm.officerPassword)) {
      toast.error('Large reversals need a second officer email and password');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/payments/${reversePayment.id}/reverse`, {
        reason: reverseForm.reason,
        confirming_officer_email: needsConfirmation ? reverseForm.officerEmail : undefined,
        confirming_officer_password: needsConfirmation ? reverseForm.officerPassword : undefined,
      });
      toast.success('Payment reversed');
      setShowReverse(false);
      setReversePayment(null);
      setReverseForm({ reason: '', officerEmail: '', officerPassword: '' });
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
              <div><span>{formatDate(p.date)}</span><span className="ml-3 text-gray-500">{p.method}</span><span className="ml-2 text-gray-400">{p.reference}</span>{p.reversed && <span className="ml-2 text-xs text-red-500">Reversed</span>}</div>
              <div className="flex items-center gap-3">
                <span className={`font-medium ${p.reversed ? 'text-gray-400 line-through' : ''}`}>{formatLKR(p.amount)}</span>
                {!p.reversed && <button onClick={() => { setReversePayment(p); setReverseForm({ reason: '', officerEmail: '', officerPassword: '' }); setShowReverse(true); }} className="text-red-500 text-xs hover:underline">Reverse</button>}
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
          <Input label="Amount (LKR)" type="number" step="0.01" min="0.01" max={invoice.balance} value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} />
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
          <p className="text-sm text-gray-600">Reverse {reversePayment ? formatLKR(reversePayment.amount) : 'this payment'}? The invoice balance will be restored.</p>
          <Input label="Reason for reversal" value={reverseForm.reason} onChange={(e) => setReverseForm((f) => ({ ...f, reason: e.target.value }))} placeholder="At least 10 characters" />
          {reversePayment?.amount > 50000 && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Large reversals require a different finance/admin officer to re-authenticate.</p>
              <Input label="Second officer email" type="email" value={reverseForm.officerEmail} onChange={(e) => setReverseForm((f) => ({ ...f, officerEmail: e.target.value }))} />
              <Input label="Second officer password" type="password" value={reverseForm.officerPassword} onChange={(e) => setReverseForm((f) => ({ ...f, officerPassword: e.target.value }))} />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowReverse(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleReversePayment} loading={actionLoading}>Reverse Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
