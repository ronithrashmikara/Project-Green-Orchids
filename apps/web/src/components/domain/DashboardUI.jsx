'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Tone palette — maps to Tailwind colour tokens
   ───────────────────────────────────────────── */
const tones = {
  emerald: { bg: 'bg-emerald-50',  icon: 'bg-emerald-500',  text: 'text-emerald-700',  border: 'border-emerald-100', badge: 'bg-emerald-500/10 text-emerald-700', heading: 'text-emerald-600' },
  sky:     { bg: 'bg-sky-50',      icon: 'bg-sky-500',      text: 'text-sky-700',      border: 'border-sky-100',     badge: 'bg-sky-500/10 text-sky-700',         heading: 'text-sky-600' },
  violet:  { bg: 'bg-violet-50',   icon: 'bg-violet-500',   text: 'text-violet-700',   border: 'border-violet-100',  badge: 'bg-violet-500/10 text-violet-700',   heading: 'text-violet-600' },
  amber:   { bg: 'bg-amber-50',    icon: 'bg-amber-500',    text: 'text-amber-700',    border: 'border-amber-100',   badge: 'bg-amber-500/10 text-amber-700',     heading: 'text-amber-600' },
  rose:    { bg: 'bg-rose-50',     icon: 'bg-rose-500',     text: 'text-rose-700',     border: 'border-rose-100',    badge: 'bg-rose-500/10 text-rose-700',       heading: 'text-rose-600' },
  slate:   { bg: 'bg-slate-50',    icon: 'bg-slate-700',    text: 'text-slate-700',    border: 'border-slate-200',   badge: 'bg-slate-100 text-slate-700',        heading: 'text-slate-600' },
};

function tone(t) { return tones[t] || tones.emerald; }

/* ─────────────────────────────────────────────
   PageHeader / DashboardHero
   Clean top section with title, description, stat pills and actions
   ───────────────────────────────────────────── */
export function DashboardHero({ eyebrow, title, description, actions, stats = [], tone: t = 'emerald' }) {
  const c = tone(t);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className={cn('text-[11px] font-bold uppercase tracking-widest', c.heading)}>{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>

      {stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <div key={s.label} className={cn('flex items-center gap-2 rounded-full border px-3.5 py-1.5', c.border, c.bg)}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</span>
              <span className={cn('text-sm font-bold', c.text)}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PageHeader — compact header for list/detail pages
   (same visual language as DashboardHero, no stat pills)
   ───────────────────────────────────────────── */
export function PageHeader({ eyebrow, title, description, actions, back, tone: t = 'emerald' }) {
  const c = tone(t);
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-600">
            ← {back.label || 'Back'}
          </Link>
        )}
        {eyebrow && <p className={cn('text-[11px] font-bold uppercase tracking-widest', c.heading)}>{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-[26px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MetricCard
   White card with coloured icon area + big number
   ───────────────────────────────────────────── */
export function MetricCard({ label, value, detail, icon, tone: t = 'emerald', href }) {
  const c = tone(t);
  const inner = (
    <div className={cn(
      'group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow',
      href && 'hover:shadow-md cursor-pointer',
    )}>
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white', c.icon)}>
          {icon}
        </div>
        {detail && <span className="text-[11px] font-medium text-slate-500">{detail}</span>}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="mt-0.5 text-[13px] font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

/* ─────────────────────────────────────────────
   GlassPanel → now a clean white Panel
   ───────────────────────────────────────────── */
export function GlassPanel({ children, title, subtitle, action, className }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            {title && <p className="text-[14px] font-semibold text-slate-800">{title}</p>}
            {subtitle && <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ActionTile — compact quick-action card
   ───────────────────────────────────────────── */
export function ActionTile({ href, title, description, icon, tone: t = 'emerald' }) {
  const c = tone(t);
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm"
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base text-white', c.icon)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 group-hover:text-slate-900">{title}</p>
        {description && <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{description}</p>}
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────
   PrimaryAction — button-style CTA
   ───────────────────────────────────────────── */
export function PrimaryAction({ href, children, variant = 'solid', tone: t = 'emerald' }) {
  const c = tone(t);
  const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all';
  const solid = cn(base, c.icon, 'text-white hover:opacity-90 shadow-sm');
  const ghost = cn(base, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50');
  return (
    <Link href={href} className={variant === 'solid' ? solid : ghost}>
      {children}
    </Link>
  );
}

/* ─────────────────────────────────────────────
   ProgressLine — labelled progress bar
   ───────────────────────────────────────────── */
export function ProgressLine({ label, value, max, format, tone: t = 'emerald' }) {
  const c = tone(t);
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const formatted = format ? format(value) : value;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-800">{formatted}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', c.icon)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   AlertRow — attention item with count badge
   ───────────────────────────────────────────── */
export function AlertRow({ label, count, href, tone: t = 'amber' }) {
  const c = tone(t);
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition-all hover:bg-white hover:border-slate-200 hover:shadow-sm"
    >
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
      <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-bold', c.badge)}>
        {count}
      </span>
    </Link>
  );
}
