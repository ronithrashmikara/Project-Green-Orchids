'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Textarea } from '@/components/ui/Button';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PriorityBadge, CategoryBadge } from '@/components/domain/ComplaintBits';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { PageHeader, GlassPanel } from '@/components/domain/DashboardUI';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function BuyerComplaintDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/complaints/${id}`);
      setComplaint(res.data.data || res.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return toast.error('Message cannot be empty');
    setSending(true);
    try {
      await api.post(`/complaints/${id}/messages`, { body: reply.trim() });
      toast.success('Message sent');
      setReply('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Spinner className="py-24" size="lg" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!complaint) return <EmptyState title="Complaint not found" />;

  const messages = complaint.messages || [];
  const isClosed = ['RESOLVED', 'CLOSED'].includes(complaint.status);

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        back={{ href: '/buyer/complaints', label: 'Complaints' }}
        title={complaint.subject || `Complaint #${complaint.id}`}
        description={`Opened ${formatDate(complaint.created_at || complaint.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassPanel className="lg:col-span-2" title="Conversation" subtitle="Messages between you and the sales team.">
          <div className="space-y-4">
            {complaint.description && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your complaint</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{complaint.description}</p>
              </div>
            )}

            {messages.length === 0 ? (
              <EmptyState title="No replies yet" description="Our sales team will respond here soon." />
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  const mine = String(m.author_id) === String(user?.id);
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[80%] rounded-xl px-4 py-2.5',
                        mine ? 'bg-violet-50 border border-violet-100' : 'bg-slate-50 border border-slate-100',
                      )}>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {mine ? 'You' : (m.author_name || 'Sales team')} · {formatDate(m.created_at)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{m.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isClosed ? (
              <form onSubmit={sendReply} className="space-y-3 border-t border-slate-100 pt-4">
                <Textarea
                  label="Add a message"
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a message…"
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={sending}>Send message</Button>
                </div>
              </form>
            ) : (
              <p className="border-t border-slate-100 pt-4 text-[13px] text-slate-500">
                This complaint has been {complaint.status === 'RESOLVED' ? 'resolved' : 'closed'}. If you still need help, raise a new complaint.
              </p>
            )}
          </div>
        </GlassPanel>

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
              <span className="text-slate-400">Opened</span>
              <span className="text-slate-600">{formatDate(complaint.created_at || complaint.createdAt)}</span>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
