'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { CreditBar, TierBadge, StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';

export default function CreditMonitorPage() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.get('/finance/credit').catch(() => ({ data: [] }));
      setBuyers(res.data.buyers || res.data.data || res.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Credit Monitor</h1>
      {loading ? <Spinner className="py-20" /> : buyers.length === 0 ? <EmptyState title="No buyers" /> : (
        <div className="space-y-4">
          {buyers.map((buyer) => (
            <Card key={buyer.id}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium">{buyer.businessName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <TierBadge tier={buyer.tier} />
                    <span className="text-xs text-gray-500">Reliability: {buyer.reliabilityScore ?? 'N/A'}</span>
                    {buyer.hasOverdue && <StatusBadge status="OVERDUE" />}
                  </div>
                </div>
              </div>
              <CreditBar used={buyer.creditUsed || 0} limit={buyer.creditLimit || 0} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
