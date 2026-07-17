'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PriorityBadge, CategoryBadge } from '@/components/domain/ComplaintBits';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatDate } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function BuyerComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/complaints${status ? `?status=${status}` : ''}`);
      const list = res.data.data || res.data.complaints || (Array.isArray(res.data) ? res.data : []);
      setComplaints(list.map((c) => ({
        id: c.id,
        subject: c.subject || `Complaint #${c.id}`,
        category: c.category,
        priority: c.priority,
        status: c.status,
        createdAt: c.created_at || c.createdAt,
      })));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'subject', label: 'Subject', render: (v) => <span className="font-semibold text-slate-800">{v}</span> },
    { key: 'category', label: 'Category', render: (v) => <CategoryBadge category={v} /> },
    { key: 'priority', label: 'Priority', render: (v) => <PriorityBadge priority={v} /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Opened', render: (v) => formatDate(v) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        title="Complaints"
        description="Raise issues about orders, deliveries, quality or billing and track their resolution."
        actions={<Link href="/buyer/complaints/new"><Button>New complaint</Button></Link>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-green-500"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && (loading ? <Spinner className="py-20" /> : complaints.length === 0 ? (
        <EmptyState
          title="No complaints"
          description="If something went wrong with an order, raise a complaint and our sales team will help."
          action={<Link href="/buyer/complaints/new"><Button>New complaint</Button></Link>}
        />
      ) : (
        <Table columns={columns} rows={complaints} onRowClick={(r) => router.push(`/buyer/complaints/${r.id}`)} />
      ))}
    </div>
  );
}
