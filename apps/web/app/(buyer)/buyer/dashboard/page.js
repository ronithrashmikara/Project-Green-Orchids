'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { KpiCard, CreditBar } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatLKR, formatDate } from '@/lib/utils';

export default function BuyerDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/me/summary');
        setSummary(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner className="py-24" size="lg" />;
  if (error) return <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 font-semibold text-rose-700">Failed to load dashboard: {error}</div>;

  const s = summary || {};
  return (
    <div className="space-y-7">
      {/* Hero with quick actions */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-dark p-7 text-white shadow-pop md:p-9">
        <div className="blob -top-12 right-10 h-52 w-52 animate-blob bg-orchid-500/40" />
        <div className="blob bottom-0 left-1/4 h-44 w-44 animate-blob bg-green-500/40" style={{ animationDelay: '3s' }} />
        <div className="relative flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="eyebrow text-green-300">Trade buyer workspace</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Your order cockpit</h1>
            <p className="mt-2 max-w-lg text-white/70">Track credit, orders, invoices and RFQs at a glance.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/buyer/catalogue"><Button className="!bg-white !text-green-800 hover:!bg-green-50">Browse catalogue</Button></Link>
            <Link href="/buyer/rfq/new"><Button variant="pink">New RFQ</Button></Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Credit Available" value={formatLKR(s.creditAvailable || 0)} subtitle={s.creditLimit ? `of ${formatLKR(s.creditLimit)} limit` : undefined} icon="💳" tone="green" />
        <KpiCard title="Open Orders" value={s.openOrders || 0} icon="📦" tone="sky" />
        <KpiCard title="Unpaid Invoices" value={formatLKR(s.unpaidTotal || 0)} subtitle={`${s.unpaidCount || 0} invoices`} icon="💰" tone="amber" />
        <KpiCard title="Active RFQs" value={s.activeRfqs || 0} icon="📋" tone="pink" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {s.creditLimit > 0 && (
          <Card className="lg:col-span-2">
            <h3 className="mb-4 text-sm font-bold text-slate-700">Credit utilization</h3>
            <CreditBar used={s.creditUsed || 0} limit={s.creditLimit} />
          </Card>
        )}

        <Card className={s.creditLimit > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <h3 className="mb-4 text-sm font-bold text-slate-700">Recent activity</h3>
          {s.recentActivity?.length > 0 ? (
            <div className="space-y-1">
              {s.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-4 rounded-2xl px-3 py-2.5 text-sm transition hover:bg-green-50/60">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-green-100 to-orchid-100 text-base">🌿</span>
                    <div>
                      <span className="font-semibold text-slate-800">{a.description || a.type}</span>
                      <span className="ml-2 text-xs text-slate-400">{formatDate(a.createdAt)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-500">{a.details}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No recent activity" description="Your orders, RFQs and payments will appear here." />
          )}
        </Card>
      </div>
    </div>
  );
}
