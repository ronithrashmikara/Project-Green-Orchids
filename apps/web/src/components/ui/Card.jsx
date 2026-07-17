import { cn } from '@/lib/utils';

export function Card({ children, className, padding = true, hover = false }) {
  // `padding` may be passed as a string (legacy "p-4") or boolean.
  const pad = padding === true ? 'p-6' : typeof padding === 'string' ? padding : '';
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-slate-200 bg-white shadow-sm',
        hover && 'transition-shadow hover:shadow-md',
        pad,
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div>
        {title && <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>}
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
