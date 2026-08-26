'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge, StatusStepper, InvoiceCard } from '@/components/domain';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatLKR, formatDate } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Real order.status enum (apps/api/migrations/0005 + the CLOSED addition from
// a later migration): DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PROCESSING,
// READY_TO_SHIP, DISPATCHED, DELIVERED, CLOSED, CANCELLED, RETURNED.
const STEP_MAP = ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'READY_TO_SHIP', 'DISPATCHED', 'DELIVERED', 'CLOSED'];

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data.data);
        // The order record itself carries no invoice reference — fetch it separately.
        try {
          const invRes = await api.get(`/invoices?order_id=${id}`);
          const invoices = invRes.data.data || invRes.data.invoices || [];
          if (invoices.length) setInvoice(invoices[0]);
        } catch {
          // No invoice yet (order not approved) — not an error.
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/orders/${id}/cancel`);
      setOrder((o) => ({ ...o, status: 'CANCELLED' }));
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/orders/${id}/confirm-receipt`);
      toast.success('Receipt confirmed');
      setOrder((o) => ({ ...o, status: 'CLOSED' }));
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (error) return <ErrorState message={error} />;
  if (!order) return <ErrorState message="Order not found" />;

  const canCancel = order.status === 'PENDING_APPROVAL';
  const canConfirm = order.status === 'DELIVERED';
  const canReturn = order.status === 'DELIVERED' || order.status === 'CLOSED';

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        back={{ href: '/buyer/orders', label: 'Back' }}
        title={`Order #${order.order_no || order.id}`}
        description={<> {formatDate(order.created_at)}{order.po_reference ? <> · PO: <span className="font-mono">{order.po_reference}</span></> : null} </>}
        actions={<StatusBadge status={order.status} />}
      />

      {order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (
        <StatusStepper steps={STEP_MAP} current={order.status} />
      )}

      {/* Line Items */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Order Items</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left py-2">Product</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Unit Price</th><th className="text-right py-2">Total</th></tr></thead>
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-2">{item.product_name || item.product_id}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">{formatLKR(item.unit_price_at_order)}</td>
                <td className="text-right py-2 font-medium">{formatLKR(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.buyer_note && <p className="mt-3 text-xs text-slate-500">Note: {order.buyer_note}</p>}
        <div className="text-right mt-4 text-lg font-bold">{formatLKR(order.total)}</div>
      </Card>

      {/* Linked Invoice */}
      {invoice && (
        <InvoiceCard
          invoice={{ invoiceNo: invoice.invoice_no, status: invoice.status, dueDate: formatDate(invoice.due_date), total: Number(invoice.total_amount), balance: Number(invoice.balance_due) }}
          onView={() => router.push(`/buyer/invoices/${invoice.id}`)}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {canCancel && <Button variant="danger" onClick={() => setConfirmCancel(true)} loading={actionLoading}>Cancel Order</Button>}
        {canConfirm && <Button onClick={handleConfirmReceipt} loading={actionLoading}>Confirm Receipt</Button>}
        {canReturn && <Link href={`/buyer/returns/new?orderId=${order.id}`}><Button variant="outline">Request Return</Button></Link>}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        title="Cancel order"
        message="Cancel this order? This cannot be undone."
        confirmLabel="Cancel order"
        variant="danger"
      />
    </div>
  );
}
