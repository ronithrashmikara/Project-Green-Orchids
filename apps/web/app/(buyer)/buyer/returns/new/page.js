'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Button, Textarea, Select } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import toast from 'react-hot-toast';

const REASONS = [
  { value: 'DAMAGED', label: 'Damaged on Delivery' },
  { value: 'WRONG_ITEM', label: 'Wrong Item' },
  { value: 'QUALITY_ISSUE', label: 'Quality Issue' },
  { value: 'SHORT_SHIPPED', label: 'Short Shipment' },
  { value: 'LATE_DELIVERY', label: 'Late Delivery' },
  { value: 'BUYER_REMORSE', label: 'Changed My Mind' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    orderId: preselectedOrderId || '',
    orderItemId: '',
    quantity: 1,
    returnType: 'DAMAGED',
    reason: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/orders?status=DELIVERED');
        setOrders(res.data.data || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!form.orderId) { setOrderItems([]); return; }
    api.get(`/orders/${form.orderId}`).then((res) => {
      const data = res.data.data || res.data;
      setOrderItems(data.items || []);
      setForm((f) => ({ ...f, orderItemId: '' }));
    }).catch(() => setOrderItems([]));
  }, [form.orderId]);

  const selectedItem = orderItems.find((i) => String(i.id) === String(form.orderItemId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.orderId) return toast.error('Select an order');
    if (!form.orderItemId) return toast.error('Select an item');
    if ((form.reason || '').length < 20) return toast.error('Description must be at least 20 characters');
    if (selectedItem && form.quantity > selectedItem.qty) return toast.error(`Quantity exceeds delivered (${selectedItem.qty})`);
    setSubmitting(true);
    try {
      const res = await api.post(`/orders/${form.orderId}/request-return`, {
        order_item_id: Number(form.orderItemId),
        quantity: Number(form.quantity),
        reason: form.reason,
        return_type: form.returnType,
      });
      toast.success('Return request submitted');
      router.push(`/buyer/returns/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      <PageHeader tone="violet" title="New Return" description="Submit a return request for items from a delivered order." />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Select Delivered Order"
            value={form.orderId}
            onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
            options={[{ value: '', label: 'Select order...' }, ...orders.map((o) => ({ value: o.id, label: `#${o.order_no || o.id}` }))]}
          />

          {orderItems.length > 0 && (
            <>
              <Select
                label="Item to Return"
                value={form.orderItemId}
                onChange={(e) => setForm((f) => ({ ...f, orderItemId: e.target.value }))}
                options={[{ value: '', label: 'Select item...' }, ...orderItems.map((i) => ({ value: i.id, label: `${i.product_name} (delivered: ${i.qty})` }))]}
              />
              {selectedItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to return (max {selectedItem.qty})</label>
                  <input type="number" min={1} max={selectedItem.qty} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Math.min(Math.max(1, parseInt(e.target.value) || 1), selectedItem.qty) }))} className="w-24 px-2 py-1.5 border rounded text-sm" />
                </div>
              )}
            </>
          )}

          <Select label="Reason" value={form.returnType} onChange={(e) => setForm((f) => ({ ...f, returnType: e.target.value }))} options={REASONS} />
          <Textarea label="Description (min 20 characters)" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />

          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={submitting}>Submit Return</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
