'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { unwrap, isMine, isUnassigned, COMPLAINT_STATUSES, COMPLAINT_PRIORITIES } from '@/lib/sales';
import { PageHeader, GlassPanel } from '@/components/domain/DashboardUI';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PriorityBadge, CategoryBadge } from '@/components/domain/ComplaintBits';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const filterSelectClass =
  'rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-400';

export default function SalesComplaintsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const complaintsQuery = useQuery({
    queryKey: ['sales', 'complaints-queue', status, priority],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      const qs = params.toString();
      const res = await api.get(`/complaints/queue${qs ? `?${qs}` : ''}`);
      const d = unwrap(res);
      return Array.isArray(d) ? d : d?.complaints || [];
    },
  });

  const claimMutation = useMutation({
    mutationFn: (id) => api.patch(`/complaints/${id}`, { assigned_to: user?.id }),
    onSuccess: () => {
      toast.success('Complaint claimed');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to claim complaint'),
  });

  if (complaintsQuery.isLoading) return <Spinner className="py-20" />;

  const rows = (complaintsQuery.data || []).map((c) => ({
    id: c.id,
    subject: c.subject || `Complaint #${c.id}`,
    buyerName: c.buyer_name || c.buyerName || '—',
    category: c.category,
    priority: c.priority,
    status: c.status,
    assignedTo: c.assigned_to ?? c.assignedTo ?? null,
    assignedToName: c.assigned_to_name || c.assignedToName || null,
    createdAt: c.created_at || c.createdAt,
    raw: c,
  }));

  const columns = [
    { key: 'subject', label: 'Subject', render: (v) => <span className="font-semibold text-slate-800">{v}</span> },
    { key: 'buyerName', label: 'Buyer' },
    { key: 'category', label: 'Category', render: (v) => <CategoryBadge category={v} /> },
    { key: 'priority', label: 'Priority', render: (v) => <PriorityBadge priority={v} /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'assignedToName', label: 'Assigned to', render: (v, r) => (
      r.assignedTo
        ? <span className={isMine(r.raw, user?.id) ? 'font-semibold text-slate-800' : 'text-slate-600'}>
            {isMine(r.raw, user?.id) ? 'You' : (v || `#${r.assignedTo}`)}
          </span>
        : <span className="text-slate-400">Unassigned</span>
    )},
    { key: 'createdAt', label: 'Opened', render: (v) => formatDate(v) },
    { key: 'actions', label: '', className: 'text-right', render: (_, r) => (
      isUnassigned(r.raw) && (
        <span onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            loading={claimMutation.isPending && claimMutation.variables === r.id}
            onClick={() => claimMutation.mutate(r.id)}
          >
            Claim
          </Button>
        </span>
      )
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        tone="emerald"
        title="Complaints queue"
        description="Buyer complaints assigned to you, plus unassigned complaints waiting to be claimed."
      />

      <GlassPanel>
        <div className="flex flex-wrap items-center gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={filterSelectClass}>
            <option value="">All statuses</option>
            {COMPLAINT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={filterSelectClass}>
            <option value="">All priorities</option>
            {COMPLAINT_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </GlassPanel>

      {complaintsQuery.isError ? (
        <ErrorState message={complaintsQuery.error?.message} onRetry={() => complaintsQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No complaints in the queue" description="New buyer complaints will appear here." />
      ) : (
        <Table columns={columns} rows={rows} onRowClick={(r) => router.push(`/sales/complaints/${r.id}`)} />
      )}
    </div>
  );
}
