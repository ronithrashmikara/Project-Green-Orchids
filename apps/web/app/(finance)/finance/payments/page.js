'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Table } from '@/components/ui/Table';
import { Button, Input, Textarea } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

function normalizePayment(p) {
  return {
    id: p.id,
    paymentNo: p.payment_no,
    invoiceNo: p.invoice_no,
    buyerName: p.buyer_name,
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    date: p.received_at,
    reversed: !!p.reversed_at,
  };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverseModal, setReverseModal] = useState({ open: false, payment: null, reason: '', officerEmail: '', officerPassword: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get('/payments?limit=100').catch(() => ({ data: { data: [] } }));
    setPayments((res.data.data || []).map(normalizePayment));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openReverse = (p) => setReverseModal({ open: true, payment: p, reason: '', officerEmail: '', officerPassword: '' });

  const needsConfirmation = reverseModal.payment && reverseModal.payment.amount > 50000;

  const handleReverse = async () => {
    const { payment, reason, officerEmail, officerPassword } = reverseModal;
    if (reason.trim().length < 10) return toast.error('Reason must be at least 10 characters');
    if (needsConfirmation && (!officerEmail || !officerPassword)) return toast.error('Reversals over LKR 50,000 need a second officer email and password');
    setSubmitting(true);
    try {
      await api.post(`/payments/${payment.id}/reverse`, {
        reason,
        confirming_officer_email: needsConfirmation ? officerEmail : undefined,
        confirming_officer_password: needsConfirmation ? officerPassword : undefined,
      });
      toast.success('Payment reversed');
      setReverseModal({ open: false, payment: null, reason: '', officerEmail: '', officerPassword: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Reversal failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        tone="sky"
        title="Payment History"
        description="Browse recorded payments across all invoices."
      />
      {loading ? <Spinner className="py-20" /> : payments.length === 0 ? <EmptyState title="No payments" /> : (
        <Table
          columns={[
            { key: 'paymentNo', label: 'Payment #' },
            { key: 'invoiceNo', label: 'Invoice' },
            { key: 'buyerName', label: 'Buyer' },
            { key: 'amount', label: 'Amount', render: (v) => formatLKR(v) },
            { key: 'method', label: 'Method' },
            { key: 'reference', label: 'Reference' },
            { key: 'date', label: 'Date', render: (v) => formatDate(v) },
            { key: 'reversed', label: 'Status', render: (v) => v ? <StatusBadge status="REVERSED" /> : <StatusBadge status="RECORDED" /> },
            { key: 'actions', label: '', render: (_, r) => (
              !r.reversed && <Button size="sm" variant="ghost" onClick={() => openReverse(r)}>Reverse</Button>
            )},
          ]}
          rows={payments}
        />
      )}

      <Modal open={reverseModal.open} onClose={() => setReverseModal({ open: false, payment: null, reason: '', officerEmail: '', officerPassword: '' })} title="Reverse Payment" size="sm">
        {reverseModal.payment && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reverse {reverseModal.payment.paymentNo} ({formatLKR(reverseModal.payment.amount)})? The invoice balance will be restored.
            </p>
            <Textarea
              label="Reason (required, min 10 characters)"
              value={reverseModal.reason}
              onChange={(e) => setReverseModal((m) => ({ ...m, reason: e.target.value }))}
              placeholder="Why is this payment being reversed?"
            />
            {needsConfirmation && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">Large reversals require a different finance/admin officer to re-authenticate.</p>
                <Input
                  label="Second officer email"
                  type="email"
                  value={reverseModal.officerEmail}
                  onChange={(e) => setReverseModal((m) => ({ ...m, officerEmail: e.target.value }))}
                />
                <Input
                  label="Second officer password"
                  type="password"
                  value={reverseModal.officerPassword}
                  onChange={(e) => setReverseModal((m) => ({ ...m, officerPassword: e.target.value }))}
                />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReverseModal({ open: false, payment: null, reason: '', officerEmail: '', officerPassword: '' })}>Cancel</Button>
              <Button variant="danger" onClick={handleReverse} loading={submitting}>Reverse Payment</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
