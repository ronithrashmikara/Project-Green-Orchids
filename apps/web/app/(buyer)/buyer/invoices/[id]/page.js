'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button, Input } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Modal } from '@/components/ui/Modal';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPay, setShowPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '' });

  const load = async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      const inv = res.data.data || res.data;
      setInvoice(inv);
      setPayForm((f) => ({ ...f, amount: String(inv.balance_due || '') }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handlePay = async () => {
    const amount = parseFloat(payForm.amount);
    const balance = Number(invoice.balance_due);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter a valid amount');
    if (amount > balance) return toast.error('Amount cannot exceed the balance due');
    setPaying(true);
    try {
      const res = await api.post(`/invoices/${id}/pay`, { amount });
      const checkout = res.data.data || res.data;
      if (!checkout?.checkout_url) {
        throw new Error('Stripe checkout URL was not returned');
      }
      toast.success('Redirecting to Stripe…');
      window.location.href = checkout.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
    } catch {
      toast.error('Download failed');
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (error) return <ErrorState message={error} />;
  if (!invoice) return <ErrorState message="Invoice not found" />;

  const canPay = Number(invoice.balance_due) > 0 && !['CANCELLED', 'VOID'].includes(invoice.status);

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        back={{ href: '/buyer/invoices', label: 'Back' }}
        title={`Invoice #${invoice.invoice_no}`}
        description={`${formatDate(invoice.created_at)} · Due: ${formatDate(invoice.due_date)}`}
        actions={<StatusBadge status={invoice.status} />}
      />

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-medium mb-3">Summary</h3>
          <div className="space-y-2">
            {invoice.order_no && (
              <div className="flex justify-between text-sm">
                <span>Order</span>
                <Link href={`/buyer/orders/${invoice.order_id}`} className="text-violet-600 hover:underline">{invoice.order_no}</Link>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatLKR(invoice.total_amount)}</span></div>
            {Number(invoice.paid_amount) > 0 && <div className="flex justify-between text-sm text-green-700"><span>Paid</span><span>{formatLKR(invoice.paid_amount)}</span></div>}
            <div className="flex justify-between text-sm font-medium"><span>Balance</span><span>{formatLKR(invoice.balance_due)}</span></div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium mb-2">Payment History</h3>
          {!invoice.payments?.length ? (
            <p className="text-sm text-gray-400 py-4 text-center">No payments recorded yet</p>
          ) : (
            <div className="space-y-2">
              {invoice.payments.map((p) => (
                <div key={p.id} className="text-sm flex justify-between border-b pb-1 last:border-b-0">
                  <span>{formatDate(p.received_at)} · {p.method}{p.reversed_at ? ' (reversed)' : ''}</span>
                  <span className={p.reversed_at ? 'text-gray-400 line-through' : ''}>{formatLKR(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleDownloadPDF}>Download PDF</Button>
        {canPay && <Button onClick={() => setShowPay(true)}>Pay with Stripe</Button>}
      </div>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="Pay Online with Stripe" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Balance due: <strong>{formatLKR(invoice.balance_due)}</strong></p>
          <p className="text-xs text-gray-500">Your invoice balance updates only after Stripe sends a verified webhook.</p>
          <Input
            label="Amount (LKR)"
            type="number"
            step="0.01"
            min="0.01"
            max={invoice.balance_due}
            value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowPay(false)}>Cancel</Button>
            <Button onClick={handlePay} loading={paying}>Continue to Stripe</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
