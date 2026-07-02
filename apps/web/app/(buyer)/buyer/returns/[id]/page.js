'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatDate } from '@/lib/utils';

export default function ReturnDetailPage() {
  const { id } = useParams();
  const [rma, setRma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/rma/${id}`);
        setRma(res.data.data || res.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Spinner className="py-20" />;
  if (error) return <ErrorState message={error} />;
  if (!rma) return <ErrorState message="Return not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        back={{ href: '/buyer/returns', label: 'Back' }}
        title={`RMA #${rma.rma_no || rma.id}`}
        description={`${formatDate(rma.created_at)} · Order #${rma.order_no || rma.order_id}`}
        actions={<StatusBadge status={rma.status} />}
      />

      <Card>
        <h3 className="text-sm font-medium mb-2">Return Details</h3>
        <p className="text-sm"><strong>Category:</strong> {rma.reason_category}</p>
        <p className="text-sm mt-1"><strong>Description:</strong> {rma.reason_detail}</p>
        <div className="mt-2">
          <strong className="text-sm">Items:</strong>
          <ul className="text-sm mt-1 space-y-1">
            {rma.items?.map((item, i) => (
              <li key={i}>{item.product_name} × {item.qty}</li>
            ))}
          </ul>
        </div>
      </Card>

      {rma.resolution && (
        <Card>
          <h3 className="text-sm font-medium mb-2">Admin Resolution</h3>
          <p className="text-sm text-gray-600">{rma.resolution}</p>
        </Card>
      )}
    </div>
  );
}
