'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export default function ReturnsListPage() {
  const router = useRouter();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/returns');
        setReturns(res.data.returns || res.data.data || res.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const columns = [
    { key: 'rmaNo', label: 'RMA #', render: (v, r) => v || r.id },
    { key: 'orderNo', label: 'Order', render: (v, r) => v || r.orderId },
    { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Returns</h1>
        <Link href="/buyer/returns/new"><Button>New Return</Button></Link>
      </div>
      {loading ? <Spinner className="py-20" /> : returns.length === 0 ? <EmptyState title="No returns" /> : (
        <Table columns={columns} rows={returns} onRowClick={(r) => router.push(`/buyer/returns/${r.id}`)} />
      )}
    </div>
  );
}
