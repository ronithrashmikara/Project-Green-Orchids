'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { StatusBadge, TimelineView } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { formatDate, formatLKR } from '@/lib/utils';

export default function ReturnDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rma, setRma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/returns/${id}`);
        setRma(res.data);
      } catch (err) {
        setError(err.message);
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
      <button onClick={() => router.back()} className="text-sm text-green-700 hover:underline">&larr; Back</button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RMA #{rma.rmaNo || rma.id}</h1>
          <p className="text-sm text-gray-500">{formatDate(rma.createdAt)} &middot; Order #{rma.orderNo}</p>
        </div>
        <StatusBadge status={rma.status} />
      </div>

      <Card>
        <h3 className="text-sm font-medium mb-2">Return Details</h3>
        <p className="text-sm"><strong>Reason:</strong> {rma.reason}</p>
        <p className="text-sm mt-1"><strong>Description:</strong> {rma.description || rma.detail}</p>
        <div className="mt-2">
          <strong className="text-sm">Items:</strong>
          <ul className="text-sm mt-1 space-y-1">
            {rma.items?.map((item, i) => (
              <li key={i}>{item.productName} × {item.quantity}</li>
            ))}
          </ul>
        </div>
      </Card>

      {rma.evidence?.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium mb-2">Evidence</h3>
          <div className="flex gap-3">
            {rma.evidence.map((url, i) => (
              <img key={i} src={url} alt={`Evidence ${i + 1}`} className="w-24 h-24 object-cover rounded border" />
            ))}
          </div>
        </Card>
      )}

      {rma.resolutionNotes && (
        <Card>
          <h3 className="text-sm font-medium mb-2">Admin Resolution</h3>
          <p className="text-sm text-gray-600">{rma.resolutionNotes}</p>
        </Card>
      )}

      {rma.timeline?.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium mb-4">Timeline</h3>
          <TimelineView events={rma.timeline} />
        </Card>
      )}
    </div>
  );
}
