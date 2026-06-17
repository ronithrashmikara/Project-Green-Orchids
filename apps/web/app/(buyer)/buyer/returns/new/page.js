'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Textarea, Select } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

const REASONS = [
  { value: 'damaged', label: 'Damaged on Delivery' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'quality', label: 'Quality Issue' },
  { value: 'short_ship', label: 'Short Shipment' },
  { value: 'other', label: 'Other' },
];

export default function NewReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    orderId: preselectedOrderId || '',
    items: [],
    reason: '',
    detail: '',
    evidence: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/orders?status=DELIVERED');
        setOrders(res.data.orders || res.data.data || res.data);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!form.orderId) return;
    api.get(`/orders/${form.orderId}`).then((res) => {
      setForm((f) => ({ ...f, items: (res.data.items || []).map((item) => ({ productId: item.productId, productName: item.productName, quantity: 0, maxQty: item.quantity })) }));
    }).catch(() => {});
  }, [form.orderId]);

  const updateItem = (idx, qty) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => i === idx ? { ...item, quantity: Math.min(Math.max(0, parseInt(qty) || 0), item.maxQty) } : item),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason) { toast.error('Select a reason'); return; }
    if ((form.detail || '').length < 20) { toast.error('Description must be at least 20 characters'); return; }
    const returnItems = form.items.filter((i) => i.quantity > 0);
    if (returnItems.length === 0) { toast.error('Select at least one item to return'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('orderId', form.orderId);
      formData.append('reason', form.reason);
      formData.append('detail', form.detail);
      formData.append('items', JSON.stringify(returnItems));
      form.evidence.forEach((f) => formData.append('evidence', f));
      const res = await api.post('/returns', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Return request submitted');
      router.push(`/buyer/returns/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Return</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Select Delivered Order"
            value={form.orderId}
            onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
            options={orders.map((o) => ({ value: o.id, label: `#${o.orderNo || o.id} - ${o.date || ''}` }))}
          />

          {form.items.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Items to Return</label>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <span className="text-sm flex-1">{item.productName}</span>
                    <span className="text-xs text-gray-500">Max: {item.maxQty}</span>
                    <input type="number" min={0} max={item.maxQty} value={item.quantity} onChange={(e) => updateItem(idx, e.target.value)} className="w-20 px-2 py-1 border rounded text-sm" placeholder="Qty" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Select label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} options={REASONS} />
          <Textarea label="Detail (min 20 characters)" value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />

          <FileUpload label="Upload evidence (photos)" onUpload={(file) => setForm((f) => ({ ...f, evidence: [...f.evidence, file] }))} />

          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={submitting}>Submit Return</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
