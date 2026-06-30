'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatLKR, formatDate } from '@/lib/utils';
import { ActionTile, DashboardHero, GlassPanel, MetricCard, PrimaryAction } from '@/components/domain/DashboardUI';

const BUCKET_TONES = {
  '0-30': { bar: 'from-emerald-300 to-emerald-500', text: 'text-emerald-200' },
  '31-60': { bar: 'from-amber-300 to-amber-500', text: 'text-amber-200' },
  '61-90': { bar: 'from-orange-300 to-orange-500', text: 'text-orange-200' },
  '90+': { bar: 'from-rose-300 to-pink-500', text: 'text-rose-200' },
};

export default function FinanceDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [dashRes, paymentsRes, overdueRes] = await Promise.all([
        api.get('/finance/dashboard').catch(() => ({ data: {} })),
        api.get('/payments?limit=5&sort=createdAt:desc').catch(() => ({ data: [] })),
        api.get('/invoices?status=OVERDUE&limit=5').catch(() => ({ data: [] })),
      ]);
      setData(dashRes.data);

      const pp = paymentsRes.data;
      setRecentPayments(pp.payments || pp.data || (Array.isArray(pp) ? pp : []));

      const op = overdueRes.data;
      setOverdueInvoices(op.invoices || op.data || (Array.isArray(op) ? op : []));

      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner className="py-24" size="lg" />;
  const d = data || {};

  const agingBuckets = d.agingBuckets || { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const maxAging = Math.max(...Object.values(agingBuckets), 1);

  const overdueCount = d.overdueCount || overdueInvoices.length || 0;
  const paymentsThisMonth = d.collectedThisMonth || d.paymentsThisMonth || 0;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Receivables desk"
        title="Finance dashboard"
        description="Track collections, overdue exposure, aging buckets and invoice pressure in one polished view."
        tone="sky"
        actions={(
          <>
            <PrimaryAction href="/finance/invoices">Open invoices</PrimaryAction>
            <PrimaryAction href="/finance/payments" variant="ghost">Record payment</PrimaryAction>
          </>
        )}
        stats={[
          { label: 'Outstanding', value: d.outstandingCount || 0 },
          { label: 'Overdue', value: formatLKR(d.overdueTotal || 0) },
          { label: 'Collected', value: formatLKR(paymentsThisMonth) },
          { label: 'Aging buckets', value: Object.keys(agingBuckets).length },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total receivables" value={formatLKR(d.totalReceivables || 0)} detail="Total open balance" icon="📊" tone="emerald" />
        <MetricCard label="Overdue total" value={formatLKR(d.overdueTotal || 0)} detail="Past due exposure" icon="⚠️" tone="rose" />
        <MetricCard label="Payments this month" value={formatLKR(paymentsThisMonth)} detail="Current month cash-in" icon="✅" tone="sky" />
        <MetricCard label="Overdue invoices" value={overdueCount} detail="Invoices past due date" icon="🚨" tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel
          title="Aging analysis"
          subtitle="Click a band to drill into invoices by risk age."
          action={<span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/45 sm:inline-flex">Live receivables</span>}
        >
          <div className="space-y-4">
            {Object.entries(agingBuckets).map(([label, amount]) => {
              const tone = BUCKET_TONES[label] || BUCKET_TONES['0-30'];
              return (
                <button key={label} className="w-full text-left transition hover:opacity-90" onClick={() => router.push(`/finance/aging?bucket=${label}`)}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-semibold text-white/65">{label} days</span>
                    <span className={`font-extrabold ${tone.text}`}>{formatLKR(amount)}</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-white/8">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tone.bar} transition-all duration-700`} style={{ width: `${Math.max((amount / maxAging) * 100, 2)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </GlassPanel>

        <GlassPanel
          title="Overdue invoices"
          subtitle="Invoices requiring immediate follow-up."
          action={<Link href="/finance/invoices?status=OVERDUE" className="text-xs font-semibold text-rose-300 hover:text-rose-200">View all →</Link>}
        >
          {overdueInvoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/30">No overdue invoices</p>
          ) : (
            <div className="space-y-2">
              {overdueInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/finance/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{inv.invoiceNumber || inv.reference || `INV-${inv.id?.slice(0, 6)}`}</p>
                    <p className="truncate text-xs text-white/35">{inv.buyerName || inv.buyer?.businessName || '—'} · Due {formatDate(inv.dueDate, 'yyyy-MM-dd')}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-rose-200">{formatLKR(inv.amount || inv.totalAmount || 0)}</span>
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel
        title="Recent payments"
        subtitle="Latest payments received."
        action={<Link href="/finance/payments" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">View all →</Link>}
      >
        {recentPayments.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{p.reference || p.paymentNumber || `PMT-${p.id?.slice(0, 6)}`}</p>
                  <p className="truncate text-xs text-white/35">{p.buyerName || p.buyer?.businessName || '—'} · {formatDate(p.createdAt, 'yyyy-MM-dd')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold text-emerald-200">{formatLKR(p.amount || 0)}</span>
                  <StatusBadge status={p.status || 'PAID'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-3">
        <ActionTile href="/finance/invoices" title="Invoices" description="View and manage all customer invoices and balances." icon="🧾" tone="sky" />
        <ActionTile href="/finance/payments" title="Payments" description="Record incoming payments and match to invoices." icon="💳" tone="emerald" />
        <ActionTile href="/finance/credit-notes" title="Credit notes" description="Manage issued credit notes and adjustments." icon="📝" tone="amber" />
      </div>
    </div>
  );
}
