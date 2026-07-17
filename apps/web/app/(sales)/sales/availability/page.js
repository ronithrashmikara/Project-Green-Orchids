'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchAvailability } from '@/lib/sales';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

export default function TeamAvailabilityPage() {
  const { user } = useAuth();
  const availabilityQuery = useQuery({ queryKey: ['sales', 'availability'], queryFn: fetchAvailability });

  if (availabilityQuery.isLoading) return <Spinner className="py-20" />;
  if (availabilityQuery.isError) {
    return <ErrorState message={availabilityQuery.error?.message} onRetry={() => availabilityQuery.refetch()} />;
  }

  const rows = (availabilityQuery.data || []).map((m) => ({
    id: m.user_id,
    name: m.name,
    status: m.status,
    openComplaints: m.open_complaints ?? 0,
    pendingApprovals: m.pending_approvals ?? 0,
  }));

  const columns = [
    { key: 'name', label: 'Sales manager', render: (v, r) => (
      <div className="flex items-center gap-2.5">
        <span className={cn(
          'h-2.5 w-2.5 shrink-0 rounded-full',
          r.status === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-amber-400',
        )} />
        <span className="font-semibold text-slate-800">
          {v}{String(r.id) === String(user?.id) && <span className="ml-1.5 text-[11px] font-medium text-slate-400">(you)</span>}
        </span>
      </div>
    )},
    { key: 'status', label: 'Status', render: (v) => (
      <Badge variant={v === 'AVAILABLE' ? 'success' : 'warning'}>{v === 'AVAILABLE' ? 'Available' : 'Away'}</Badge>
    )},
    { key: 'pendingApprovals', label: 'Pending approvals', render: (v) => <span className="tabular-nums font-semibold text-slate-700">{v}</span> },
    { key: 'openComplaints', label: 'Open complaints', render: (v) => <span className="tabular-nums font-semibold text-slate-700">{v}</span> },
  ];

  const availableCount = rows.filter((r) => r.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        tone="emerald"
        title="Team availability"
        description={`${availableCount} of ${rows.length} sales managers available. Availability drives how new work is distributed.`}
      />
      {rows.length === 0
        ? <EmptyState title="No sales managers found" description="Team members will appear here once they have accounts." />
        : <Table columns={columns} rows={rows} />}
    </div>
  );
}
