'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatLKR, formatDate } from '@/lib/utils';
import { ActionTile, DashboardHero, GlassPanel, MetricCard, PrimaryAction } from '@/components/domain/DashboardUI';

const quickActions = [
  { href: '/finance/invoices',   title: 'Invoices',        description: 'View and manage all buyer invoices.',   icon: '🧾', tone: 'sky'     },
  { href: '/finance/payments',   title: 'Record payment',  description: 'Log an incoming buyer payment.',        icon: '💳', tone: 'emerald' },
  { href: '/finance/aging',      title: 'Ageing report',   description: 'Review overdue and at-risk invoices.',  icon: '📊', tone: 'amber'   },
  { href: '/finance/statements', title: 'Statements',      description: 'Generate buyer account statements.',    icon: '📄', tone: 'violet'  },
];

export default function FinanceDashboardPage() {
  const [data, setData]     = useState({ summary: {}, invoices: [], payments: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [sumRes, invRes, payRes] = await Promise.all([
        api.get('/reports/summary').catch(() => api.get('/reports/revenue').catch(() => ({ data: {} }))),
        api.get('/invoices?limit=5&sort=due_date:asc').catch(() => ({ data: [] })),
        api.get('/payments?limit=5').catch(() => ({ data: [] })),
      ]);
      const sp = sumRes.data;
      const ip = invRes.data;
      const pp = payRes.data;
      setData({
        summary:  sp || {},
        invoices: ip.invoices || ip.data || (Array.isArray(ip) ? ip : []),
        payments: pp.payments || pp.data || (Array.isArray(pp) ? pp : []),
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner className="py-24" size="lg" />;

  const s       = data.summary;
  const overdue = data.invoices.filter((i) => i.status === 'OVERDUE').length;
  const totalDue = data.invoices.reduce((a, i) => a + parseFloat(i.balance_due || i.balanceDue || 0), 0);

  return (
    <div className="space-y-7">
      <DashboardHero
        eyebrow="Finance desk"
        title="Financial overview"
        description="Track revenue, monitor outstanding invoices and manage buyer payments."
        tone="sky"
        actions={<>
          <PrimaryAction href="/finance/invoices" tone="sky" variant="solid">View invoices</PrimaryAction>
          <PrimaryAction href="/finance/payments" tone="sky" variant="ghost">Record payment</PrimaryAction>
        </>}
        stats={[
          { label: 'Open invoices', value: data.invoices.length },
          { label: 'Overdue',       value: overdue },
          { label: 'Total due',     value: formatLKR(totalDue) },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue (month)"   value={formatLKR(s.revenueThisMonth || s.revenue || 0)} detail="Current month sales" icon="💰" tone="emerald" href="/finance/statements" />
        <MetricCard label="Payments received" value={formatLKR(s.paymentsThisMonth || 0)}            detail="Month to date"        icon="💳" tone="sky"     href="/finance/payments"   />
        <MetricCard label="Overdue invoices"  value={overdue}                                         detail="Past due date"        icon="⚠️" tone="rose"    href="/finance/aging"      />
        <MetricCard label="Outstanding total" value={formatLKR(totalDue)}                            detail="All open balances"    icon="📊" tone="amber"   href="/finance/invoices"   />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel
          title="Open invoices"
          subtitle="Sorted by due date ascending."
          action={<Link href="/finance/invoices" className="text-[12px] font-semibold text-sky-600 hover:text-sky-700">View all →</Link>}
        >
          {data.invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No open invoices</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.invoices.map((inv) => (
                <Link key={inv.id} href={`/finance/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-4 py-3 -mx-5 px-5 rounded-xl transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{inv.invoice_no || `INV-${inv.id}`}</p>
                    <p className="text-[12px] text-slate-500">Due {formatDate(inv.due_date || inv.dueDate, 'dd MMM yyyy')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[13px] font-semibold text-slate-700">{formatLKR(inv.balance_due || inv.total_amount || 0)}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Recent payments"
          subtitle="Latest recorded buyer payments."
          action={<Link href="/finance/payments" className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700">View all →</Link>}
        >
          {data.payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No payments recorded yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.payments.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{pay.payment_no || `PAY-${pay.id}`}</p>
                    <p className="text-[12px] text-slate-500">{pay.method || '—'} · {formatDate(pay.created_at, 'dd MMM yyyy')}</p>
                  </div>
                  <span className="text-[13px] font-semibold text-emerald-600">+{formatLKR(pay.amount || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel title="Quick actions" subtitle="Finance workspace shortcuts.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => <ActionTile key={a.href} {...a} />)}
        </div>
      </GlassPanel>
    </div>
  );
}
