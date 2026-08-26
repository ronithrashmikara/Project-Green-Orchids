'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GlassPanel, MetricCard, DashboardHero } from '@/components/domain/DashboardUI';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState({ open: false, action: null, title: '', message: '', variant: 'info', label: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data.data || res.data.order || res.data);
      } catch { toast.error('Failed to load order'); }
      setLoading(false);
    })();
  }, [id]);

  const orderAction = (endpoint, newStatus, title, message, variant, label, successMsg, body = {}) => {
    setConfirm({
      open: true,
      title,
      message,
      variant,
      label,
      action: async () => {
        try {
          await api.patch(`/orders/${id}/${endpoint}`, body);
          setOrder((o) => ({ ...o, status: newStatus }));
          toast.success(successMsg);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update order'); }
      },
    });
  };

  if (loading) return <Spinner className="py-24" size="lg" />;
  if (!order) return <EmptyState title="Order not found" />;

  const items = order.items || order.lineItems || order.orderItems || [];
  const payment = order.payment || order.payments?.[0] || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/orders" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-800">
          ← Orders
        </Link>
        <div className="flex-1">
          <DashboardHero
            eyebrow="Order detail"
            title={`Order #${order.order_no || order.orderNumber || order.id}`}
            tone="sky"
            stats={[
              { label: 'Status', value: order.status },
              { label: 'Date', value: formatDate(order.created_at || order.createdAt, 'yyyy-MM-dd') },
              { label: 'Total', value: formatLKR(order.total || order.totalAmount || 0) },
              { label: 'Payment', value: order.payment_status || order.paymentStatus || payment.status || '—' },
              { label: 'PO Ref', value: order.po_reference || order.poReference || '—' },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassPanel className="lg:col-span-2" title="Line items">
          {items.length === 0 ? <EmptyState title="No items" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Product', 'SKU', 'Qty', 'Unit price', 'Line total'].map((h) => (
                      <th key={h} className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 pr-4 font-medium text-slate-800">{item.productName || item.product?.name || '—'}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-400">{item.sku || item.product?.sku || '—'}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.quantity || item.qty}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatLKR(item.unitPrice || item.price || 0)}</td>
                      <td className="py-3 pr-4 font-semibold text-emerald-600">{formatLKR((item.unitPrice || item.price || 0) * (item.quantity || item.qty || 0))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={4} className="py-3 pr-4 text-right font-semibold text-slate-500">Total</td>
                    <td className="py-3 text-lg font-bold text-emerald-600">{formatLKR(order.total || order.totalAmount || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </GlassPanel>

        <div className="space-y-5">
          <GlassPanel title="Buyer">
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-slate-800">{order.buyer_name || order.buyerName || order.buyer?.businessName || '—'}</p>
              <p className="text-slate-400">{order.buyer_email || order.buyerEmail || order.buyer?.email || '—'}</p>
              {order.buyer?.id && (
                <Link href={`/admin/buyers/${order.buyer.id}`} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">View buyer profile →</Link>
              )}
            </div>
          </GlassPanel>

          {(order.shipping_address || order.shippingAddress || order.deliveryAddress) && (
            <GlassPanel title="Shipping address">
              <p className="whitespace-pre-line text-sm text-slate-600">{order.shipping_address || order.shippingAddress || order.deliveryAddress}</p>
            </GlassPanel>
          )}

          <GlassPanel title="Payment">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <StatusBadge status={order.paymentStatus || payment.status || 'UNPAID'} />
              </div>
              {payment.amount && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Amount paid</span>
                  <span className="font-semibold text-emerald-600">{formatLKR(payment.amount)}</span>
                </div>
              )}
              {payment.method && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Method</span>
                  <span className="text-slate-600">{payment.method}</span>
                </div>
              )}
            </div>
          </GlassPanel>

          <GlassPanel title="Admin actions">
            <div className="flex flex-col gap-2">
              {order.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    onClick={() => orderAction('approve', 'APPROVED', 'Approve order', 'Approve this order? Stock will be allocated and the buyer notified.', 'info', 'Approve', 'Order approved')}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Approve Order
                  </button>
                  <button
                    onClick={async () => {
                      const reason = window.prompt('Reason for rejection (min 10 characters):');
                      if (!reason || reason.trim().length < 10) { if (reason !== null) toast.error('Reason must be at least 10 characters'); return; }
                      try {
                        await api.patch(`/orders/${id}/reject`, { reason });
                        setOrder((o) => ({ ...o, status: 'REJECTED' }));
                        toast.success('Order rejected');
                      } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject order'); }
                    }}
                    className="rounded-xl border border-amber-200 bg-amber-50 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    Reject Order
                  </button>
                </>
              )}
              {!['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(order.status) && (
                <button
                  onClick={() => orderAction('cancel', 'CANCELLED', 'Cancel order', 'This will cancel the order and may trigger stock reversal. This action is irreversible.', 'danger', 'Cancel Order', 'Order cancelled')}
                  className="rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Cancel Order
                </button>
              )}
              {['APPROVED', 'PROCESSING', 'READY_TO_SHIP', 'DISPATCHED'].includes(order.status) && (
                <Link
                  href="/admin/deliveries"
                  className="rounded-xl border border-sky-200 bg-sky-50 py-2 text-center text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  Manage Delivery →
                </Link>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm((c) => ({ ...c, open: false }))}
        onConfirm={() => confirm.action?.()}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.label}
        variant={confirm.variant}
      />
    </div>
  );
}
