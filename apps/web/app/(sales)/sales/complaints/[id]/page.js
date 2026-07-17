'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { unwrap, fetchAvailability } from '@/lib/sales';
import { PageHeader, GlassPanel } from '@/components/domain/DashboardUI';
import { Button, Select, Textarea } from '@/components/ui/Button';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PriorityBadge, CategoryBadge } from '@/components/domain/ComplaintBits';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const TRANSITIONS = {
  OPEN: [{ status: 'IN_PROGRESS', label: 'Start progress' }, { status: 'CLOSED', label: 'Close' }],
  IN_PROGRESS: [{ status: 'RESOLVED', label: 'Resolve' }, { status: 'CLOSED', label: 'Close' }],
  RESOLVED: [{ status: 'CLOSED', label: 'Close' }],
  CLOSED: [],
};

export default function SalesComplaintDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [reassignTo, setReassignTo] = useState('');

  const complaintQuery = useQuery({
    queryKey: ['sales', 'complaint', id],
    queryFn: async () => unwrap(await api.get(`/complaints/${id}`)),
  });
  const availabilityQuery = useQuery({ queryKey: ['sales', 'availability'], queryFn: fetchAvailability });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sales', 'complaint', id] });
    queryClient.invalidateQueries({ queryKey: ['sales', 'complaints-queue'] });
    queryClient.invalidateQueries({ queryKey: ['sales', 'queue'] });
  };

  const patchMutation = useMutation({
    mutationFn: (body) => api.patch(`/complaints/${id}`, body),
    onSuccess: (_res, body) => {
      toast.success(body.status ? `Complaint marked ${body.status.replace(/_/g, ' ').toLowerCase()}` : 'Complaint reassigned');
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to update complaint'),
  });

  const replyMutation = useMutation({
    mutationFn: (body) => api.post(`/complaints/${id}/messages`, { body }),
    onSuccess: () => {
      toast.success('Reply sent');
      setReply('');
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to send reply'),
  });

  if (complaintQuery.isLoading) return <Spinner className="py-24" size="lg" />;
  if (complaintQuery.isError) {
    return <ErrorState message={complaintQuery.error?.message} onRetry={() => complaintQuery.refetch()} />;
  }

  const complaint = complaintQuery.data;
  if (!complaint) return <EmptyState title="Complaint not found" />;

  const messages = complaint.messages || [];
  const team = availabilityQuery.data || [];
  const assignedTo = complaint.assigned_to ?? complaint.assignedTo ?? null;
  const transitions = TRANSITIONS[complaint.status] || [];

  const sendReply = (e) => {
    e.preventDefault();
    if (!reply.trim()) return toast.error('Reply cannot be empty');
    replyMutation.mutate(reply.trim());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        tone="emerald"
        back={{ href: '/sales/complaints', label: 'Complaints queue' }}
        title={complaint.subject || `Complaint #${complaint.id}`}
        description={`Opened ${formatDate(complaint.created_at || complaint.createdAt)} by ${complaint.buyer_name || complaint.buyerName || 'buyer'}`}
        actions={
          <div className="flex items-center gap-2">
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Message thread */}
        <GlassPanel className="lg:col-span-2" title="Conversation" subtitle="Message thread with the buyer.">
          <div className="space-y-4">
            {complaint.description && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Original complaint</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{complaint.description}</p>
              </div>
            )}

            {messages.length === 0 ? (
              <EmptyState title="No messages yet" description="Reply below to start the conversation." />
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  const mine = String(m.author_id) === String(user?.id);
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[80%] rounded-xl px-4 py-2.5',
                        mine ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100',
                      )}>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {mine ? 'You' : (m.author_name || 'Buyer')} · {formatDate(m.created_at)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{m.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={sendReply} className="space-y-3 border-t border-slate-100 pt-4">
              <Textarea
                label="Reply to buyer"
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write your reply…"
              />
              <div className="flex justify-end">
                <Button type="submit" loading={replyMutation.isPending}>Send reply</Button>
              </div>
            </form>
          </div>
        </GlassPanel>

        {/* Side column */}
        <div className="space-y-5">
          <GlassPanel title="Details">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Category</span>
                <CategoryBadge category={complaint.category} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Priority</span>
                <PriorityBadge priority={complaint.priority} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <StatusBadge status={complaint.status} />
              </div>
              {(complaint.order_id || complaint.orderId) && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Related order</span>
                  <span className="font-mono text-xs font-semibold text-slate-700">#{complaint.order_no || complaint.order_id || complaint.orderId}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Assigned to</span>
                <span className="font-medium text-slate-700">
                  {assignedTo
                    ? (String(assignedTo) === String(user?.id) ? 'You' : (complaint.assigned_to_name || complaint.assignedToName || `#${assignedTo}`))
                    : 'Unassigned'}
                </span>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="Actions">
            <div className="flex flex-col gap-2">
              {!assignedTo && (
                <Button variant="outline" loading={patchMutation.isPending}
                  onClick={() => patchMutation.mutate({ assigned_to: user?.id })}>
                  Claim complaint
                </Button>
              )}
              {transitions.map((t) => (
                <Button
                  key={t.status}
                  variant={t.status === 'CLOSED' ? 'outline' : 'primary'}
                  loading={patchMutation.isPending}
                  onClick={() => patchMutation.mutate({ status: t.status })}
                >
                  {t.label}
                </Button>
              ))}
              {transitions.length === 0 && assignedTo && (
                <p className="text-[13px] text-slate-500">This complaint is closed — no further actions available.</p>
              )}
            </div>
          </GlassPanel>

          <GlassPanel title="Reassign" subtitle="Hand this complaint to another sales manager.">
            <div className="space-y-3">
              <Select
                label="Sales manager"
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                options={[
                  { value: '', label: 'Select manager…' },
                  ...team
                    .filter((m) => String(m.user_id) !== String(assignedTo ?? ''))
                    .map((m) => ({
                      value: m.user_id,
                      label: `${m.name}${m.status === 'AWAY' ? ' (away)' : ''} — ${m.open_complaints ?? 0} open`,
                    })),
                ]}
              />
              <Button
                variant="secondary"
                className="w-full"
                disabled={!reassignTo}
                loading={patchMutation.isPending}
                onClick={() => {
                  patchMutation.mutate({ assigned_to: reassignTo }, { onSuccess: () => setReassignTo('') });
                }}
              >
                Reassign
              </Button>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
