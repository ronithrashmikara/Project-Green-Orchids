'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatDate } from '@/lib/utils';

export default function ReturnsListPage() {
  const router = useRouter();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/rma');
        setReturns((res.data.data || []).map((r) => ({
          id: r.id,
          rmaNo: r.rma_no,
          orderNo: r.order_no,
          createdAt: r.created_at,
          reason: r.reason_detail || r.reason_category,
          status: r.status,
        })));
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
      <PageHeader
        tone="violet"
        title="Returns"
        description="View and track your return (RMA) requests."
        actions={<Link href="/buyer/returns/new"><Button>New Return</Button></Link>}
      />
      {loading ? <Spinner className="py-20" /> : returns.length === 0 ? <EmptyState title="No returns" /> : (
        <Table columns={columns} rows={returns} onRowClick={(r) => router.push(`/buyer/returns/${r.id}`)} />
      )}
    </div>
  );
}
