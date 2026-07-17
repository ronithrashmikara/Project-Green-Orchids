'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Textarea, Select } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/domain/DashboardUI';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'ORDER_ISSUE', label: 'Order issue' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

export default function NewComplaintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');

  const [orders, setOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    category: 'ORDER_ISSUE',
    priority: 'MEDIUM',
    description: '',
    orderId: preselectedOrderId || '',
  });

  useEffect(() => {
    api.get('/orders?limit=50')
      .then((res) => setOrders(res.data.data || []))
      .catch(() => setOrders([]));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim()) return toast.error('Subject is required');
    if (form.description.trim().length < 20) return toast.error('Description must be at least 20 characters');
    setSubmitting(true);
    try {
      const res = await api.post('/complaints', {
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        order_id: form.orderId ? Number(form.orderId) : undefined,
      });
      toast.success('Complaint submitted');
      const created = res.data.data || res.data;
      router.push(created?.id ? `/buyer/complaints/${created.id}` : '/buyer/complaints');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        back={{ href: '/buyer/complaints', label: 'Complaints' }}
        title="New complaint"
        description="Tell us what went wrong and our sales team will pick it up."
      />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Subject"
            value={form.subject}
            onChange={set('subject')}
            placeholder="Short summary of the issue"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" value={form.category} onChange={set('category')} options={CATEGORIES} />
            <Select label="Priority" value={form.priority} onChange={set('priority')} options={PRIORITIES} />
          </div>
          <Select
            label="Related order (optional)"
            value={form.orderId}
            onChange={set('orderId')}
            options={[
              { value: '', label: 'No specific order' },
              ...orders.map((o) => ({ value: o.id, label: `#${o.order_no || o.id}` })),
            ]}
          />
          <Textarea
            label="Description (min 20 characters)"
            value={form.description}
            onChange={set('description')}
            placeholder="Describe the issue in detail — what happened, when, and what you'd like us to do."
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={submitting}>Submit complaint</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
