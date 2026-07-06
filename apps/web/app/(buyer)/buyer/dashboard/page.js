'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatLKR, formatDate } from '@/lib/utils';
import { ActionTile, DashboardHero, GlassPanel, MetricCard, PrimaryAction, ProgressLine } from '@/components/domain/DashboardUI';

const quickActions = [
  { href: '/buyer/catalogue', title: 'Browse catalogue',    description: 'Shop from 500+ orchid varieties.',  icon: '🌺', tone: 'emerald' },
  { href: '/buyer/cart',      title: 'View cart',           description: 'Review your current cart items.',   icon: '🛒', tone: 'violet'  },
  { href: '/buyer/rfq/new',   title: 'Submit an RFQ',       description: 'Request a quote for bulk orders.',  icon: '📋', tone: 'sky'     },
  { href: '/buyer/orders',    title: 'Order history',       description: 'Track all your placed orders.',     icon: '📦', tone: 'amber'   },
];

export default function BuyerDashboardPage() {
  const [summary, setSummary]   = useState(null);
  const [orders, setOrders]     = useState([]);
  const [rfqs, setRfqs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [sumRes, ordRes, rfqRes] = await Promise.all([
          api.get('/me/summary'),
          api.get('/orders?limit=4').catch(() => ({ data: [] })),
          api.get('/rfqs?limit=4').catch(() => ({ data: [] })),
        ]);
        setSummary(sumRes.data);
        const op = ordRes.data; setOrders(op.orders || op.data || (Array.isArray(op) ? op : []));
        const rp = rfqRes.data; setRfqs(rp.rfqs   || rp.data || (Array.isArray(rp) ? rp : []));
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner className="py-24" size="lg" />;
  if (error)   return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-700">Failed to load: {error}</div>;

  const s = summary || {};
  const usedPct = s.creditLimit > 0 ? Math.min(((s.creditUsed || 0) / s.creditLimit) * 100, 100) : 0;
  const creditHealthTone = usedPct > 85 ? 'rose' : usedPct > 60 ? 'amber' : 'emerald';
  const status = s.status || 'ACTIVE';
  const isActive = ['ACTIVE', 'APPROVED'].includes(status);

  return (
    <div className="space-y-7">
      <DashboardHero
        eyebrow="Trade buyer workspace"
        title={`Welcome back${s.businessName ? `, ${s.businessName}` : ''}`}
        description="Your order cockpit — credit exposure, open orders, invoices and RFQs at a glance."
        tone="violet"
        actions={<>
          <PrimaryAction href="/buyer/catalogue" tone="violet" variant="solid">Browse catalogue</PrimaryAction>
          <PrimaryAction href="/buyer/rfq/new"   tone="violet" variant="ghost">Submit RFQ</PrimaryAction>
        </>}
        stats={[
          { label: 'Account', value: isActive ? 'Active' : status },
          { label: 'Tier',    value: s.tier || '—' },
          { label: 'Orders',  value: s.totalOrders || orders.length },
          { label: 'Open RFQs', value: rfqs.filter((r) => !['CONVERTED', 'DECLINED', 'EXPIRED'].includes(r.status)).length },
        ]}
      />

      {/* Credit + key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Credit limit"     value={formatLKR(s.creditLimit || 0)}  detail="Total approved credit"   icon="💳" tone="emerald" />
        <MetricCard label="Credit used"      value={formatLKR(s.creditUsed || 0)}   detail="Outstanding balance"     icon="📊" tone={creditHealthTone} />
        <MetricCard label="Invoices due"     value={s.invoicesDue ?? '—'}           detail="Unpaid invoices"         icon="📄" tone="amber"   href="/buyer/invoices" />
        <MetricCard label="Payment term"     value={s.paymentTerm || s.payment_term || '—'} detail="Your credit terms" icon="📅" tone="sky" />
      </div>

      {/* Credit utilisation bar */}
      {s.creditLimit > 0 && (
        <GlassPanel title="Credit utilisation">
          <ProgressLine
            label={`${formatLKR(s.creditUsed || 0)} used of ${formatLKR(s.creditLimit)}`}
            value={s.creditUsed || 0}
            max={s.creditLimit}
            format={formatLKR}
            tone={creditHealthTone}
          />
          <p className="mt-2 text-[12px] text-slate-500">
            {(100 - usedPct).toFixed(0)}% available · {formatLKR(Math.max((s.creditLimit || 0) - (s.creditUsed || 0), 0))} remaining
          </p>
        </GlassPanel>
      )}

      {/* Orders + RFQs */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel
          title="Recent orders"
          subtitle="Your latest placed orders."
          action={<Link href="/buyer/orders" className="text-[12px] font-semibold text-violet-600 hover:text-violet-700">View all →</Link>}
        >
          {orders.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">No orders placed yet.</p>
              <Link href="/buyer/catalogue" className="mt-2 inline-block text-[13px] font-semibold text-violet-600 hover:text-violet-700">Browse the catalogue →</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((o) => (
                <Link key={o.id} href={`/buyer/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 py-3 -mx-5 px-5 rounded-xl transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">#{o.order_no || o.orderNumber || o.id}</p>
                    <p className="text-[12px] text-slate-500">{formatDate(o.created_at || o.createdAt, 'dd MMM yyyy')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[13px] font-semibold text-slate-700">{formatLKR(o.total || 0)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Active RFQs"
          subtitle="Your open quote requests."
          action={<Link href="/buyer/rfqs" className="text-[12px] font-semibold text-sky-600 hover:text-sky-700">View all →</Link>}
        >
          {rfqs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">No RFQs submitted yet.</p>
              <Link href="/buyer/rfq/new" className="mt-2 inline-block text-[13px] font-semibold text-sky-600 hover:text-sky-700">Submit a quote request →</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rfqs.map((r) => (
                <Link key={r.id} href={`/buyer/rfqs/${r.id}`}
                  className="flex items-center justify-between gap-4 py-3 -mx-5 px-5 rounded-xl transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{r.rfq_no || `RFQ-${r.id}`}</p>
                    <p className="text-[12px] text-slate-500">{formatDate(r.created_at || r.createdAt, 'dd MMM yyyy')}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Quick actions */}
      <GlassPanel title="Quick actions" subtitle="Jump into your most-used features.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => <ActionTile key={a.href} {...a} />)}
        </div>
      </GlassPanel>
    </div>
  );
}
