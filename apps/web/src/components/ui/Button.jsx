'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function Button({
  children, variant = 'primary', size = 'md', loading, disabled, className,
  type = 'button', ...props
}) {
  const base =
    'relative inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';
  const variants = {
    primary: 'text-white bg-green-700 hover:bg-green-600 focus-visible:ring-green-500 shadow-sm',
    pink: 'text-white bg-orchid-600 hover:bg-orchid-500 focus-visible:ring-orchid-400 shadow-sm',
    secondary: 'bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-500 shadow-sm',
    danger: 'text-white bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-400 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-slate-400',
    link: 'text-green-700 underline-offset-4 hover:underline hover:text-green-800',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-[15px]',
  };
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {/* Width-preserving loading: keep children rendered but invisible so the
          button doesn't change size when the spinner appears. */}
      <span className={cn('inline-flex items-center justify-center gap-2', loading && 'invisible')}>
        {children}
      </span>
      {loading && (
        <svg className="absolute h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
    </button>
  );
}

const fieldBase =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

function useField(error, hint, describedBy) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  return {
    id,
    errorId,
    hintId,
    describedBy: [describedBy, errorId, hintId].filter(Boolean).join(' ') || undefined,
  };
}

export function Input({ label, error, hint, className, id, ...props }) {
  const f = useField(error, hint, props['aria-describedby']);
  const inputId = id || f.id;
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? f.errorId : null, hint ? f.hintId : null].filter(Boolean).join(' ') || undefined}
        className={cn(
          fieldBase,
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15'
            : 'border-slate-300 focus:border-green-500 focus:ring-green-500/15',
        )}
        {...props}
      />
      {error && <p id={f.errorId} className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
      {!error && hint && <p id={f.hintId} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Select({ label, error, hint, options = [], className, id, children, ...props }) {
  const f = useField(error, hint, props['aria-describedby']);
  const selectId = id || f.id;
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? f.errorId : null, hint ? f.hintId : null].filter(Boolean).join(' ') || undefined}
        className={cn(
          fieldBase,
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15'
            : 'border-slate-300 focus:border-green-500 focus:ring-green-500/15',
        )}
        {...props}
      >
        {children || (
          <>
            <option value="">Select...</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </>
        )}
      </select>
      {error && <p id={f.errorId} className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
      {!error && hint && <p id={f.hintId} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, className, id, ...props }) {
  const f = useField(error, hint, props['aria-describedby']);
  const areaId = id || f.id;
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={areaId} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? f.errorId : null, hint ? f.hintId : null].filter(Boolean).join(' ') || undefined}
        className={cn(
          fieldBase,
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/15'
            : 'border-slate-300 focus:border-green-500 focus:ring-green-500/15',
        )}
        {...props}
      />
      {error && <p id={f.errorId} className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
      {!error && hint && <p id={f.hintId} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
