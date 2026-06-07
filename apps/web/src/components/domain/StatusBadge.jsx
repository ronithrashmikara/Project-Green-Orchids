'use client';

import { cn, formatLKR } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-200',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 ring-amber-200',
  AWAITING_APPROVAL: 'bg-amber-100 text-amber-800 ring-amber-200',
  SUBMITTED: 'bg-sky-100 text-sky-800 ring-sky-200',
  QUOTED: 'bg-plum-400/15 text-plum-600 ring-plum-400/30',
  UNDER_REVIEW: 'bg-sky-100 text-sky-800 ring-sky-200',
  ACCEPTED: 'bg-green-100 text-green-800 ring-green-200',
  APPROVED: 'bg-green-100 text-green-800 ring-green-200',
  REJECTED: 'bg-rose-100 text-rose-700 ring-rose-200',
  DECLINED: 'bg-rose-100 text-rose-700 ring-rose-200',
  CONFIRMED: 'bg-green-100 text-green-800 ring-green-200',
  CONVERTED: 'bg-green-100 text-green-800 ring-green-200',
  PROCESSING: 'bg-sky-100 text-sky-800 ring-sky-200',
  READY_TO_SHIP: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  SHIPPED: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  DISPATCHED: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  IN_TRANSIT: 'bg-sky-100 text-sky-800 ring-sky-200',
  DELIVERED: 'bg-green-100 text-green-800 ring-green-200',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200',
  RETURNED: 'bg-orange-100 text-orange-800 ring-orange-200',
  EXPIRED: 'bg-slate-100 text-slate-500 ring-slate-200',
  UNPAID: 'bg-rose-100 text-rose-700 ring-rose-200',
  PAID: 'bg-green-100 text-green-800 ring-green-200',
  PARTIAL: 'bg-amber-100 text-amber-800 ring-amber-200',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 ring-amber-200',
  OVERDUE: 'bg-rose-100 text-rose-700 ring-rose-200',
  VOID: 'bg-slate-100 text-slate-500 ring-slate-200',
  ACTIVE: 'bg-green-100 text-green-800 ring-green-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  SUSPENDED: 'bg-rose-100 text-rose-700 ring-rose-200',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-200',
  IN_STOCK: 'bg-green-100 text-green-800 ring-green-200',
  LOW_STOCK: 'bg-orange-100 text-orange-800 ring-orange-200',
  OUT_OF_STOCK: 'bg-rose-100 text-rose-700 ring-rose-200',
  OVERSTOCK: 'bg-plum-400/15 text-plum-600 ring-plum-400/30',
  REORDER: 'bg-amber-100 text-amber-800 ring-amber-200',
  FAST_MOVING: 'bg-sky-100 text-sky-800 ring-sky-200',
  DEAD_STOCK: 'bg-slate-100 text-slate-600 ring-slate-200',
  OPEN: 'bg-sky-100 text-sky-800 ring-sky-200',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-800 ring-amber-200',
  RESOLVED: 'bg-green-100 text-green-800 ring-green-200',
  READY: 'bg-green-100 text-green-800 ring-green-200',
  FAILED: 'bg-rose-100 text-rose-700 ring-rose-200',
  COMPLETED: 'bg-green-100 text-green-800 ring-green-200',
  DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
  ASSIGNED: 'bg-sky-100 text-sky-800 ring-sky-200',
};

export function StatusBadge({ status, className }) {
  const label = (status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('pill ring-1 ring-inset', STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 ring-slate-200', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

export function StatusStepper({ steps = [], current }) {
  const currentIdx = steps.indexOf(current);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={cn(
            'rounded-full px-3 py-1 text-xs font-bold',
            i <= currentIdx ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-glow' : 'bg-slate-100 text-slate-400'
          )}>
            {step.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </div>
          {i < steps.length - 1 && <div className={cn('mx-1 h-0.5 w-5', i < currentIdx ? 'bg-green-500' : 'bg-slate-200')} />}
        </div>
      ))}
    </div>
  );
}

export function CreditBar({ used = 0, limit = 0, className }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct > 90 ? 'from-rose-500 to-orchid-500' : pct > 70 ? 'from-amber-400 to-orange-500' : 'from-green-500 to-green-600';
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
        <span>{formatLKR(used)} used</span>
        <span>{formatLKR(limit)} limit</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs font-medium text-slate-400">Available: {formatLKR(Math.max(0, limit - used))} ({pct.toFixed(0)}% used)</p>
    </div>
  );
}

export function StockBand({ stock, minStock = 5 }) {
  if (stock == null) return <span className="text-xs text-slate-400">Unknown</span>;
  if (stock <= 0) return <Badge variant="danger">Out of Stock</Badge>;
  if (stock <= minStock) return <Badge variant="warning">Low: {stock}</Badge>;
  return <Badge variant="success">In Stock: {stock}</Badge>;
}

export function TierBadge({ tier, className }) {
  const colors = {
    SILVER: 'bg-gradient-to-r from-slate-300 to-slate-200 text-slate-700',
    GOLD: 'bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-900',
    PLATINUM: 'bg-gradient-to-r from-plum-400 to-orchid-400 text-white',
  };
  return (
    <span className={cn('inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-extrabold tracking-wide shadow-sm', colors[tier] || 'bg-slate-100 text-slate-600', className)}>
      {tier || 'STANDARD'}
    </span>
  );
}

export function PriceBlock({ basePrice, tierPrice, discount, tier, className }) {
  return (
    <div className={cn('space-y-1', className)}>
      {discount ? (
        <>
          <span className="text-sm text-slate-400 line-through">{formatLKR(basePrice)}</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-gradient">{formatLKR(tierPrice)}</span>
            <TierBadge tier={tier} />
          </div>
          <span className="text-xs font-semibold text-green-600">You save {formatLKR(basePrice - tierPrice)} ({discount}% off)</span>
        </>
      ) : (
        <span className="text-2xl font-extrabold text-gradient">{formatLKR(basePrice)}</span>
      )}
    </div>
  );
}

const KPI_TONES = {
  green: 'from-green-500 to-green-600 shadow-glow',
  pink: 'from-orchid-500 to-orchid-400 shadow-glow-pink',
  plum: 'from-plum-500 to-plum-400',
  sky: 'from-sky-500 to-cyan-500',
  amber: 'from-amber-400 to-orange-500',
  slate: 'from-slate-700 to-slate-900',
};

export function KpiCard({ title, value, subtitle, trend, icon, tone = 'green', accent, className }) {
  const t = KPI_TONES[tone] || KPI_TONES.green;
  return (
    <div className={cn('group relative overflow-hidden rounded-3xl border border-white/70 bg-white/85 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur-xl lift hover:shadow-card-lg', className)}>
      <div className={cn('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-15 blur-xl transition group-hover:opacity-30', t)} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p>}
          {trend != null && (
            <span className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-600')}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-xl text-white', t)}>
          {icon || '🌿'}
        </div>
      </div>
    </div>
  );
}

export function TimelineView({ events = [], className }) {
  return (
    <div className={cn('space-y-4', className)}>
      {events.map((event, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn('h-3 w-3 rounded-full ring-4', i === 0 ? 'bg-green-500 ring-green-100' : 'bg-slate-300 ring-slate-100')} />
            {i < events.length - 1 && <div className="mt-1 w-0.5 flex-1 bg-slate-200" />}
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{event.title || event.status}</span>
              {event.badge && <StatusBadge status={event.badge} />}
            </div>
            <p className="text-xs text-slate-400">{event.timestamp || event.date}</p>
            {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartContainer({ title, children, className }) {
  return (
    <div className={cn('rounded-3xl border border-white/70 bg-white/85 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur-xl', className)}>
      {title && <h4 className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{title}</h4>}
      {children}
    </div>
  );
}

export function AuditDiffViewer({ before = {}, after = {}, className }) {
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return (
    <div className={cn('space-y-2 text-sm', className)}>
      {Array.from(allKeys).map((key) => {
        const oldVal = JSON.stringify(before?.[key]);
        const newVal = JSON.stringify(after?.[key]);
        const changed = oldVal !== newVal;
        return (
          <div key={key} className={cn('flex gap-4 rounded-lg p-2', changed && 'bg-amber-50')}>
            <span className="w-32 shrink-0 font-semibold">{key}</span>
            <span className="w-48 truncate text-rose-600 line-through">{oldVal}</span>
            <span className="w-48 truncate text-green-600">{newVal}</span>
          </div>
        );
      })}
    </div>
  );
}
