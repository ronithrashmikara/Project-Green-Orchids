'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import { ActionTile, DashboardHero, GlassPanel, MetricCard, PrimaryAction } from '@/components/domain/DashboardUI';

export default function InventoryDashboardPage() {
  const [data, setData] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [dashRes, lowStockRes, movementsRes] = await Promise.all([
        api.get('/inventory/dashboard').catch(() => ({ data: {} })),
        api.get('/inventory/products?availability=LOW_STOCK&limit=5').catch(() =>
          api.get('/admin/products?availability=LOW_STOCK&limit=5').catch(() => ({ data: [] }))
        ),
        api.get('/inventory/movements?limit=5&sort=createdAt:desc').catch(() => ({ data: [] })),
      ]);

      setData(dashRes.data);

      const lp = lowStockRes.data;
      setLowStock(lp.products || lp.data || (Array.isArray(lp) ? lp : []));

      const mp = movementsRes.data;
      setMovements(mp.movements || mp.data || (Array.isArray(mp) ? mp : []));

      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner className="py-24" size="lg" />;
  const d = data || {};

  const alerts = [
    { value: d.lowStockAlerts || 0, label: 'Low stock', icon: '📉', tone: 'amber', href: '/inventory/alerts?type=LOW_STOCK', description: 'Items approaching reorder threshold.' },
    { value: d.fastMovingAlerts || 0, label: 'Fast moving', icon: '🚀', tone: 'sky', href: '/inventory/alerts?type=FAST_MOVING', description: 'Products moving faster than expected.' },
    { value: d.deadStockAlerts || 0, label: 'Dead stock', icon: '🪦', tone: 'rose', href: '/inventory/alerts?type=DEAD_STOCK', description: 'Slow or inactive inventory needing review.' },
  ];

  const movementIcon = (type) => {
    const icons = { IN: '📥', OUT: '📤', ADJUSTMENT: '🔧', RETURN: '↩️', TRANSFER: '↔️' };
    return icons[type?.toUpperCase()] || '📦';
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Stock house"
        title="Inventory dashboard"
        description="Catalogue health, stock value, low-stock risk and movement alerts for the orchid operation."
        tone="amber"
        actions={(
          <>
            <PrimaryAction href="/inventory/products">View products</PrimaryAction>
            <PrimaryAction href="/inventory/movements" variant="ghost">Stock movements</PrimaryAction>
          </>
        )}
        stats={[
          { label: 'Products', value: d.totalProducts || 0 },
          { label: 'Low stock', value: d.lowStockCount || 0 },
          { label: 'Out of stock', value: d.outOfStockCount || 0 },
          { label: 'Alerts', value: (d.lowStockAlerts || 0) + (d.fastMovingAlerts || 0) + (d.deadStockAlerts || 0) },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total products" value={d.totalProducts || 0} detail="Active stocked catalogue" icon="🌿" tone="emerald" />
        <MetricCard label="Stock value" value={formatLKR(d.totalStockValue || 0)} detail="Current inventory valuation" icon="💎" tone="sky" />
        <MetricCard label="Low stock items" value={d.lowStockCount || 0} detail="Products near reorder point" icon="📉" tone="amber" />
        <MetricCard label="Out of stock" value={d.outOfStockCount || 0} detail="Products unavailable now" icon="🚫" tone="rose" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel
          title="Low stock items"
          subtitle="Top 5 products approaching reorder threshold."
          action={<Link href="/inventory/alerts?type=LOW_STOCK" className="text-xs font-semibold text-amber-300 hover:text-amber-200">View all →</Link>}
        >
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/30">No low-stock items</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((p) => {
                const stockPct = p.reorderPoint > 0 ? Math.min((p.stock / p.reorderPoint) * 100, 100) : 0;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{p.name}</p>
                      <p className="font-mono text-xs text-white/35">{p.sku}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-right">
                      <div>
                        <p className="font-bold text-amber-200">{p.stock ?? '—'}</p>
                        <p className="text-xs text-white/30">units</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          title="Recent movements"
          subtitle="Latest stock in/out transactions."
          action={<Link href="/inventory/movements" className="text-xs font-semibold text-sky-300 hover:text-sky-200">View all →</Link>}
        >
          {movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/30">No recent movements</p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-base">
                      {movementIcon(m.type)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{m.productName || m.product?.name || '—'}</p>
                      <p className="text-xs text-white/35">{m.type} · {formatDate(m.createdAt, 'yyyy-MM-dd')}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 font-bold ${m.quantity > 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel title="Alert inbox" subtitle="Review inventory risk signals before they interrupt buyer orders.">
        <div className="grid gap-4 md:grid-cols-3">
          {alerts.map((a) => (
            <ActionTile
              key={a.label}
              href={a.href}
              title={`${a.value} ${a.label}`}
              description={a.description}
              icon={a.icon}
              tone={a.tone}
            />
          ))}
        </div>
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-3">
        <ActionTile href="/inventory/products" title="Products" description="View and update product stock levels." icon="🌿" tone="emerald" />
        <ActionTile href="/inventory/movements" title="Stock movements" description="Log incoming, outgoing and adjustment entries." icon="📦" tone="sky" />
        <ActionTile href="/inventory/alerts" title="Alerts" description="Review and resolve all active stock alerts." icon="🔔" tone="amber" />
      </div>
    </div>
  );
}
