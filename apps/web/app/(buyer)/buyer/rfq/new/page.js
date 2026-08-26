'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Textarea } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RFQLineBuilder } from '@/components/domain/ProductCard';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import toast from 'react-hot-toast';

const DRAFT_KEY = 'pg_rfq_draft_v1';

export default function NewRFQPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [lines, setLines] = useState([{ productId: '', quantity: 1, targetPrice: '', note: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load draft
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) setLines(JSON.parse(draft));
    } catch {}

    api.get('/products').then((r) => {
      setProducts(r.data.products || r.data.data || r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Autosave draft every 2s
  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(lines));
    }, 2000);
    return () => clearInterval(timer);
  }, [lines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lines.some((l) => !l.productId)) {
      toast.error('Please select products for all lines');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/rfqs', {
        items: lines.filter((l) => l.productId).map((l) => ({ product_id: Number(l.productId), quantity: Number(l.quantity) || 1 })),
      });
      localStorage.removeItem(DRAFT_KEY);
      toast.success('RFQ submitted successfully');
      const newId = res.data?.data?.id ?? res.data?.id;
      if (!newId) throw new Error('RFQ created but no id returned');
      router.push(`/buyer/rfq/${newId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit RFQ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      <PageHeader tone="violet" title="New RFQ" description="Request a custom quote for bulk quantities on one or more products." />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RFQLineBuilder lines={lines} onChange={setLines} products={products} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={submitting}>Submit RFQ</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
