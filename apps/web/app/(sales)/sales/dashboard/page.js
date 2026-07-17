'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchSalesQueue, fetchAvailability, isMine, isUnassigned } from '@/lib/sales';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PriorityBadge } from '@/components/domain/ComplaintBits';
import { ActionTile, DashboardHero, EmptyState, GlassPanel, MetricCard } from '@/components/domain/DashboardUI';
import { cn, formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const quickActions = [
  { href: '/sales/approvals',    title: 'Order approvals',   description: 'Review and approve pending trade orders.', icon: 'orders',    tone: 'emerald' },
  { href: '/sales/complaints',   title: 'Complaints queue',  description: 'Work assigned and unassigned complaints.', icon: 'alerts',   tone: 'sky'     },
  { href: '/sales/availability', title: 'Team availability', description: 'See who is available and their workload.', icon: 'users',     tone: 'violet'  },
];

function AvailabilityToggle({ myStatus, isPending, onChange }) {
  const available = myStatus === 'AVAILABLE';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('h-3 w-3 rounded-full', available ? 'bg-emerald-500' : 'bg-amber-400')} />
          <div>
            <p className="text-[14px] font-semibold text-slate-800">
              You are {available ? 'available' : 'away'}
            </p>
            <p className="text-[12px] text-slate-500">
              Your availability drives how new orders and complaints are distributed across the team.
              Set yourself to Away and new work stops being routed to you.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-100 p-1">
          {['AVAILABLE', 'AWAY'].map((s) => (
            <button
              key={s}
              type="button"
              disabled={isPending}
              onClick={() => myStatus !== s && onChange(s)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-[13px] font-semibold transition disabled:opacity-60',
                myStatus === s
                  ? s === 'AVAILABLE'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {s === 'AVAILABLE' ? 'Available' : 'Away'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SalesDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queueQuery = useQuery({ queryKey: ['sales', 'queue'], queryFn: fetchSalesQueue });
  const availabilityQuery = useQuery({ queryKey: ['sales', 'availability'], queryFn: fetchAvailability });

  const availabilityMutation = useMutation({
    mutationFn: (status) => api.patch('/sales/availability', { status }),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: ['sales', 'availability'] });
      const previous = queryClient.getQueryData(['sales', 'availability']);
      queryClient.setQueryData(['sales', 'availability'], (rows = []) =>
        rows.map((r) => (String(r.user_id) === String(user?.id) ? { ...r, status } : r)));
      return { previous };
    },
    onError: (err, _status, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['sales', 'availability'], ctx.previous);
      toast.error(err.response?.data?.error?.message || 'Failed to update availability');
    },
    onSuccess: (_res, status) => {
      toast.success(status === 'AVAILABLE' ? 'You are now available for new work' : 'You are marked as away');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['sales', 'availability'] }),
  });

  if (queueQuery.isLoading || availabilityQuery.isLoading) return <Spinner className="py-24" size="lg" />;
  if (queueQuery.isError) {
    return <ErrorState message={queueQuery.error?.message} onRetry={() => queueQuery.refetch()} />;
  }

  const { approvals = [], complaints = [] } = queueQuery.data || {};
  const team = availabilityQuery.data || [];
  const me = team.find((r) => String(r.user_id) === String(user?.id));
  const myStatus = me?.status || 'AVAILABLE';

  const myApprovals = approvals.filter((a) => isMine(a, user?.id));
  const myComplaints = complaints.filter((c) => isMine(c, user?.id));
  const unassignedCount =
    approvals.filter(isUnassigned).length + complaints.filter(isUnassigned).length;
  const availableCount = team.filter((r) => r.status === 'AVAILABLE').length;

  const recent = [
    ...approvals.map((a) => ({
      key: `order-${a.id}`,
      href: '/sales/approvals',
      title: `Order #${a.order_no || a.id}`,
      subtitle: `${a.buyer_name || a.buyerName || 'Buyer'} · ${formatLKR(a.total || a.totalAmount || 0)}`,
      status: a.status || 'PENDING_APPROVAL',
      createdAt: a.created_at || a.createdAt,
    })),
    ...complaints.map((c) => ({
      key: `complaint-${c.id}`,
      href: `/sales/complaints/${c.id}`,
      title: c.subject || `Complaint #${c.id}`,
      subtitle: c.buyer_name || c.buyerName || c.category || '',
      status: c.status || 'OPEN',
      priority: c.priority,
      createdAt: c.created_at || c.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 6);

  return (
    <div className="space-y-7">
      <DashboardHero
        eyebrow="Sales desk"
        title="Sales overview"
        description="Approve trade orders, resolve buyer complaints and manage how work is distributed across the team."
        tone="emerald"
        stats={[
          { label: 'My approvals', value: myApprovals.length },
          { label: 'My complaints', value: myComplaints.length },
          { label: 'Unassigned', value: unassignedCount },
        ]}
      />

      <AvailabilityToggle
        myStatus={myStatus}
        isPending={availabilityMutation.isPending}
        onChange={(status) => availabilityMutation.mutate(status)}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="My pending approvals" value={myApprovals.length} detail="Orders waiting on you" icon="orders"    tone="emerald" href="/sales/approvals" />
        <MetricCard label="My open complaints"   value={myComplaints.length} detail="Assigned to you"      icon="alerts"   tone="sky"     href="/sales/complaints" />
        <MetricCard label="Unassigned items"     value={unassignedCount}     detail="Waiting to be claimed" icon="warning"  tone="amber"   href="/sales/approvals" />
        <MetricCard label="Team available"       value={`${availableCount}/${team.length || 0}`} detail="Managers on duty" icon="users" tone="violet" href="/sales/availability" />
      </div>

      <GlassPanel title="Quick actions" subtitle="Sales workspace shortcuts.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a) => <ActionTile key={a.href} {...a} />)}
        </div>
      </GlassPanel>

      <GlassPanel
        title="Recent queue items"
        subtitle="Latest approvals and complaints in your queue."
        action={<Link href="/sales/complaints" className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700">View queue →</Link>}
      >
        {recent.length === 0 ? (
          <EmptyState
            icon="info"
            title="Queue is clear"
            description="New order approvals and complaints will appear here as they come in."
            tone="emerald"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="-mx-5 flex items-center justify-between gap-4 rounded-xl px-5 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{item.title}</p>
                  <p className="truncate text-[12px] text-slate-500">
                    {item.subtitle}{item.createdAt ? ` · ${formatDate(item.createdAt, 'dd MMM yyyy')}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.priority && <PriorityBadge priority={item.priority} />}
                  <StatusBadge status={item.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
