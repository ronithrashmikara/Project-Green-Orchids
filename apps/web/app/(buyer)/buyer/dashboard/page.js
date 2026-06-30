'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatLKR, formatDate } from '@/lib/utils';
import { ActionTile, DashboardHero, GlassPanel, MetricCard, PrimaryAction, ProgressLine } from '@/components/domain/DashboardUI';

export default function BuyerDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [summaryRes, ordersRes, rfqsRes] = await Promise.all([
          api.get('/me/summary'),
          api.get('/orders?limit=3&sort=createdAt:desc').catch(() => ({ data: [] })),
          api.get('/rfqs?limit=3&sort=createdAt:desc').catch(() => ({ data: [] })),
        ]);
        setSummary(summaryRes.data);
        const op = ordersRes.data;
        setOrders(op.orders || op.data || (Array.isArray(op) ? op : []));
        const rp = rfqsRes.data;
        setRfqs(rp.rfqs || rp.data || (Array.isArray(rp) ? rp : []));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner className="py-24" size="lg" />;
  if (error) return <div className="rounded-3xl border border-rose-300/25 bg-rose-400/10 p-5 font-semibold text-rose-200">Failed to load dashboard: {error}</div>;

  const s = summary || {};
  const usedPct = s.creditLimit > 0 ? Math.min(((s.creditUsed || 0) / s.creditLimit) * 100, 100) : 0;

  const accountStatus = s.status || 'ACTIVE';
  const statusColor = accountStatus === 'ACTIVE' || accountStatus === 'APPROVED'
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
    : accountStatus === 'SUSPENDED'
    ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
    : 'border-amber-400/20 bg-amber-400/10 text-amber-200';

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Trade buyer workspace"
        title="Your order cockpit"
        description="A clean command view for credit exposure, open orders, invoices and RFQs."
        tone="violet"
        actions={(
          <>
            <PrimaryAction href="/buyer/catalogue">Browse catalogue</PrimaryAction>
            <PrimaryAction href="/buyer/rfq/new" variant="ghost">New RFQ</PrimaryAction>
          </>
        )}
        stats={[
          { label: 'Tier', value: s.tier || 'Trade buyer' },
          { label: 'Discount', value: s.discount ? `${s.discount}%` : 'Standard' },
          { label: 'Terms', value: s.paymentTerms || 'NET terms' },
          { label: 'Credit used', value: `${usedPct.toFixed(0)}%` },
        ]}
      />

      <div className="flex items-center gap-3">
        <span className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] ${statusColor}`}>
          Account: {accountStatus}
        </span>
        {s.tier && (
          <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-violet-200">
            {s.tier} tier
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Credit available" value={formatLKR(s.creditAvailable || 0)} detail={s.creditLimit ? `${formatLKR(s.creditLimit)} total limit` : undefined} icon="💳" tone="emerald" />
        <MetricCard label="Open orders" value={s.openOrders || 0} detail="Orders not yet closed" icon="📦" tone="sky" />
        <MetricCard label="Unpaid invoices" value={formatLKR(s.unpaidTotal || 0)} detail={`${s.unpaidCount || 0} invoice${(s.unpaidCount || 0) === 1 ? '' : 's'}`} icon="💰" tone="amber" />
        <MetricCard label="Active RFQs" value={s.activeRfqs || 0} detail="Draft, submitted or quoted" icon="📋" tone="violet" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassPanel
          title="Recent orders"
          subtitle="Your last 3 orders."
          action={<Link href="/buyer/orders" className="text-xs font-semibold text-sky-300 hover:text-sky-200">View all →</Link>}
        >
          {orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Your orders will appear here once placed." />
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/buyer/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">#{o.orderNumber || o.id?.slice(0, 8)}</p>
                    <p className="text-xs text-white/35">{formatDate(o.createdAt, 'yyyy-MM-dd')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-emerald-200">{formatLKR(o.total || o.totalAmount || 0)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Active RFQs"
          subtitle="Your latest quote requests."
          action={<Link href="/buyer/rfqs" className="text-xs font-semibold text-violet-300 hover:text-violet-200">View all →</Link>}
        >
          {rfqs.length === 0 ? (
            <EmptyState title="No RFQs yet" description="Submit a quote request to get started." />
          ) : (
            <div className="space-y-2">
              {rfqs.map((r) => (
                <Link
                  key={r.id}
                  href={`/buyer/rfqs/${r.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{r.reference || r.rfqNumber || `RFQ-${r.id?.slice(0, 6)}`}</p>
                    <p className="text-xs text-white/35">{formatDate(r.createdAt, 'yyyy-MM-dd')}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {s.creditLimit > 0 && (
        <GlassPanel title="Credit utilization" subtitle="Live credit exposure against your approved account limit.">
          <div className="grid gap-6 md:grid-cols-2">
            <ProgressLine
              label="Used balance"
              value={s.creditUsed || 0}
              max={s.creditLimit}
              tone={usedPct > 90 ? 'rose' : usedPct > 70 ? 'amber' : 'emerald'}
              valueLabel={`${usedPct.toFixed(0)}%`}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Used</p>
                <p className="mt-1 text-xl font-semibold text-white">{formatLKR(s.creditUsed || 0)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Available</p>
                <p className="mt-1 text-xl font-semibold text-emerald-200">{formatLKR(Math.max(0, s.creditAvailable || 0))}</p>
              </div>
            </div>
          </div>
        </GlassPanel>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <ActionTile href="/buyer/catalogue" title="Browse catalogue" description="Shop approved trade pricing and add items to cart." icon="🌿" tone="emerald" />
        <ActionTile href="/buyer/orders" title="My orders" description="Review order status, totals and fulfilment progress." icon="📦" tone="sky" />
        <ActionTile href="/buyer/rfqs" title="My RFQs" description="Manage active quote requests and view responses." icon="📋" tone="violet" />
        <ActionTile href="/buyer/cart" title="Cart" description="Review items in your cart and proceed to checkout." icon="🛒" tone="amber" />
      </div>
    </div>
  );
}
