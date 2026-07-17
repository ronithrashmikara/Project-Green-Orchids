'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatLKR } from '@/lib/utils';
import { ActionTile, DashboardHero, EmptyState, GlassPanel, MetricCard, PrimaryAction, ProgressLine } from '@/components/domain/DashboardUI';

const quickActions = [
  { href: '/inventory/products',  title: 'Products',        description: 'View stock levels for all SKUs.',        icon: 'products',  tone: 'emerald' },
  { href: '/inventory/alerts',    title: 'Stock alerts',    description: 'Review low and out-of-stock items.',     icon: 'alerts',    tone: 'rose'    },
  { href: '/inventory/movements', title: 'Movements',       description: 'Audit all stock adjustments and flows.', icon: 'movements', tone: 'sky'     },
  { href: '/admin/suppliers',     title: 'Suppliers',       description: 'Manage supplier accounts and lead times.',icon: 'suppliers', tone: 'amber'   },
];

export default function InventoryDashboardPage() {
  const [metrics, setMetrics]   = useState({});
  const [lowStock, setLowStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const [mRes, lRes, mvRes] = await Promise.all([
        api.get('/inventory/dashboard').catch(() => ({ data: {} })),
        api.get('/inventory/alerts?limit=6').catch(() => ({ data: [] })),
        api.get('/inventory/movements?limit=5').catch(() => ({ data: [] })),
      ]);
      setMetrics(mRes.data || {});
      const lp = lRes.data;  setLowStock(lp.items || lp.alerts || lp.data || (Array.isArray(lp) ? lp : []));
      const mp = mvRes.data; setMovements(mp.movements || mp.data || (Array.isArray(mp) ? mp : []));
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardSkeleton />;

  const m = metrics;
  const healthPct = m.totalProducts > 0
    ? Math.round(((m.totalProducts - (m.lowStockCount || m.lowStockAlerts || 0) - (m.outOfStockCount || 0)) / m.totalProducts) * 100)
    : 100;

  return (
    <div className="space-y-7">
      <DashboardHero
        eyebrow="Inventory hub"
        title="Stock overview"
        description="Monitor stock health, low-stock alerts and all product movements in one place."
        tone="amber"
        actions={<>
          <PrimaryAction href="/inventory/alerts"   tone="amber" variant="solid">View alerts</PrimaryAction>
          <PrimaryAction href="/inventory/products" tone="amber" variant="ghost">Browse stock</PrimaryAction>
        </>}
        stats={[
          { label: 'Total products', value: m.totalProducts || 0 },
          { label: 'Low stock',      value: m.lowStockAlerts || m.lowStockCount || 0 },
          { label: 'Out of stock',   value: m.outOfStockCount || 0 },
          { label: 'Stock health',   value: `${healthPct}%` },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total SKUs"       value={m.totalProducts || 0}                    detail="Active products"         icon="products" tone="emerald" href="/inventory/products" />
        <MetricCard label="Stock value"      value={formatLKR(m.totalStockValue || 0)} detail="At cost price"      icon="revenue"  tone="sky"     />
        <MetricCard label="Low stock items"  value={m.lowStockAlerts || m.lowStockCount || 0} detail="Below reorder level"   icon="warning"  tone="amber"   href="/inventory/alerts"   />
        <MetricCard label="Out of stock"     value={m.outOfStockCount || 0}                  detail="Zero available units"   icon="ban"      tone="rose"    href="/inventory/alerts"   />
      </div>

      {/* Stock health bar */}
      <GlassPanel title="Stock health">
        <ProgressLine
          label={`${m.totalProducts - (m.lowStockAlerts || 0) - (m.outOfStockCount || 0)} healthy products of ${m.totalProducts || 0} total`}
          value={m.totalProducts - (m.lowStockAlerts || 0) - (m.outOfStockCount || 0)}
          max={m.totalProducts || 1}
          tone={healthPct > 85 ? 'emerald' : healthPct > 60 ? 'amber' : 'rose'}
        />
        <p className="mt-2 text-[12px] text-slate-500">
          {m.lowStockAlerts || 0} items below reorder level · {m.outOfStockCount || 0} out of stock
        </p>
      </GlassPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel
          title="Low stock alerts"
          subtitle="Items approaching or at zero."
          action={<Link href="/inventory/alerts" className="text-[12px] font-semibold text-amber-600 hover:text-amber-700">View all →</Link>}
        >
          {lowStock.length === 0 ? (
            <EmptyState
              icon="checkCircle"
              title="All stock levels healthy"
              description="Nothing is below its reorder level right now. Great work."
              tone="emerald"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStock.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{item.name || item.productName || '—'}</p>
                    <p className="text-[12px] text-slate-500">{item.sku || '—'} · reorder at {item.reorder_level || item.reorderLevel || 0}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-[13px] font-bold tabular-nums ${(item.stock_qty || item.stockQty || item.available || 0) === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {item.stock_qty ?? item.stockQty ?? item.available ?? 0} left
                    </span>
                    <StatusBadge status={(item.stock_qty || item.available || 0) === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Recent movements"
          subtitle="Latest stock adjustments and flows."
          action={<Link href="/inventory/movements" className="text-[12px] font-semibold text-sky-600 hover:text-sky-700">View all →</Link>}
        >
          {movements.length === 0 ? (
            <EmptyState
              icon="movements"
              title="No movements recorded yet"
              description="Stock receipts, adjustments and order deductions will show up here."
              action={{ href: '/inventory/movements', label: 'View movement log' }}
              tone="sky"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {movements.map((mv, i) => (
                <div key={mv.id || i} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      {mv.product_name || mv.productName || mv.sku || `Product #${mv.product_id || mv.productId}`}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {mv.movement_type || mv.type || '—'} · {mv.reference || ''}
                    </p>
                  </div>
                  <span className={`text-[13px] font-bold tabular-nums ${(mv.quantity || mv.qty || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(mv.quantity || mv.qty || 0) > 0 ? '+' : ''}{mv.quantity || mv.qty || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel title="Quick actions" subtitle="Inventory workspace shortcuts.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => <ActionTile key={a.href} {...a} />)}
        </div>
      </GlassPanel>
    </div>
  );
}
