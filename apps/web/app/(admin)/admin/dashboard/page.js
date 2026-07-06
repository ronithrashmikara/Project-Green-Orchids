'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatLKR, formatDate } from '@/lib/utils';
import { AlertRow, ActionTile, DashboardHero, GlassPanel, MetricCard, PrimaryAction } from '@/components/domain/DashboardUI';

const quickLinks = [
  { href: '/admin/buyers',   title: 'Buyer accounts',    description: 'Approve trade accounts and manage credit tiers.',    icon: '👥', tone: 'emerald' },
  { href: '/admin/products', title: 'Product catalogue',  description: 'Update orchids, prices, stock and product images.',  icon: '🌿', tone: 'sky'     },
  { href: '/admin/rfqs',     title: 'RFQ desk',           description: 'Quote submitted requests and convert accepted deals.',icon: '📋', tone: 'violet'  },
  { href: '/admin/orders',   title: 'Orders',             description: 'View and manage all trade orders.',                  icon: '📦', tone: 'amber'   },
  { href: '/admin/cms',      title: 'CMS',                description: 'Edit homepage content, branding and media.',         icon: '✏️', tone: 'rose'    },
  { href: '/admin/users',    title: 'Staff accounts',     description: 'Manage staff logins and access roles.',              icon: '🔑', tone: 'slate'   },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState({ inventory: {}, buyers: [], orders: [], rfqs: [], revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [invRes, buyRes, ordRes, rfqRes, revRes] = await Promise.all([
        api.get('/inventory/dashboard').catch(() => ({ data: {} })),
        api.get('/buyers?limit=100').catch(() => ({ data: [] })),
        api.get('/orders?limit=5').catch(() => ({ data: [] })),
        api.get('/rfqs?limit=5').catch(() => ({ data: [] })),
        api.get('/reports/summary').catch(() => api.get('/reports/revenue').catch(() => ({ data: {} }))),
      ]);

      const bp = buyRes.data;
      const op = ordRes.data;
      const rp = rfqRes.data;
      const rv = revRes.data;

      setData({
        inventory: invRes.data || {},
        buyers:  bp.buyers  || bp.data  || (Array.isArray(bp) ? bp : []),
        orders:  op.orders  || op.data  || (Array.isArray(op) ? op : []),
        rfqs:    rp.rfqs    || rp.data  || (Array.isArray(rp) ? rp : []),
        revenue: rv.revenueThisMonth || rv.totalRevenue || rv.revenue || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner className="py-24" size="lg" />;

  const inv = data.inventory || {};
  const buyers = Array.isArray(data.buyers) ? data.buyers : [];
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const rfqs   = Array.isArray(data.rfqs)   ? data.rfqs   : [];
  const pending = buyers.filter((b) => ['PENDING_APPROVAL', 'AWAITING_APPROVAL'].includes(b.status || b.account_status)).length;
  const active  = buyers.filter((b) => ['ACTIVE', 'APPROVED'].includes(b.status || b.account_status)).length;

  return (
    <div className="space-y-7">
      <DashboardHero
        eyebrow="Admin command centre"
        title="Operations dashboard"
        description="A live overview of buyers, stock, catalogue governance and daily trade operations."
        tone="emerald"
        actions={<>
          <PrimaryAction href="/admin/buyers" tone="emerald" variant="solid">Review buyers</PrimaryAction>
          <PrimaryAction href="/admin/products" tone="emerald" variant="ghost">Manage catalogue</PrimaryAction>
        </>}
        stats={[
          { label: 'Buyers', value: buyers.length },
          { label: 'Pending', value: pending },
          { label: 'Low stock', value: inv.lowStockAlerts || inv.lowStockCount || 0 },
          { label: 'Out of stock', value: inv.outOfStockCount || 0 },
        ]}
      />

      {/* Metric row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total products"    value={inv.totalProducts || 0}    detail="Active SKUs"          icon="🌿" tone="emerald" href="/admin/products" />
        <MetricCard label="Revenue (month)"   value={formatLKR(data.revenue)}   detail="Current month"        icon="💰" tone="sky"     href="/admin/reports"  />
        <MetricCard label="Pending approvals" value={pending}                    detail="Awaiting review"      icon="👥" tone="amber"   href="/admin/buyers"   />
        <MetricCard label="Active buyers"     value={active || buyers.length}   detail="Approved accounts"    icon="✅" tone="violet"  href="/admin/buyers"   />
      </div>

      {/* Orders + RFQs */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel
          title="Recent orders"
          subtitle="Latest 5 orders placed on the platform."
          action={<Link href="/admin/orders" className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700">View all →</Link>}
        >
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No orders yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 py-3 transition hover:bg-slate-50 -mx-5 px-5 rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      #{o.order_no || o.orderNumber || o.id}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">
                      {o.buyer_name || o.buyerName || '—'} · {formatDate(o.created_at || o.createdAt, 'dd MMM yyyy')}
                    </p>
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
          title="Recent RFQs"
          subtitle="Latest quote requests from buyers."
          action={<Link href="/admin/rfqs" className="text-[12px] font-semibold text-violet-600 hover:text-violet-700">View all →</Link>}
        >
          {rfqs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No RFQs yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rfqs.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/rfqs/${r.id}`}
                  className="flex items-center justify-between gap-4 py-3 transition hover:bg-slate-50 -mx-5 px-5 rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      {r.rfq_no || r.reference || `RFQ-${r.id}`}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">
                      {r.buyer_name || r.buyerName || '—'} · {formatDate(r.created_at || r.createdAt, 'dd MMM yyyy')}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Alerts + Quick actions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel title="Attention needed" subtitle="Operational queues requiring action.">
          <div className="space-y-2">
            <AlertRow label="Buyer approvals"      count={pending}                                href="/admin/buyers"              tone="amber" />
            <AlertRow label="Low stock alerts"     count={inv.lowStockAlerts || inv.lowStockCount || 0} href="/inventory/alerts"     tone="rose"  />
            <AlertRow label="Out-of-stock items"   count={inv.outOfStockCount || 0}              href="/admin/products?availability=OUT" tone="rose" />
          </div>
        </GlassPanel>

        <GlassPanel title="Quick actions" subtitle="Jump into the core admin workspaces.">
          <div className="grid gap-2 sm:grid-cols-2">
            {quickLinks.map((item) => (
              <ActionTile key={item.href} {...item} />
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
