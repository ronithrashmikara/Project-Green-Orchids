'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  danger: {
    icon: '🗑️',
    ring: 'border-rose-400/25',
    glow: 'from-rose-500/20 via-pink-600/10 to-transparent',
    confirm: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30',
    title: 'text-rose-200',
  },
  warning: {
    icon: '⚠️',
    ring: 'border-amber-400/25',
    glow: 'from-amber-400/20 via-orange-500/10 to-transparent',
    confirm: 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/30',
    title: 'text-amber-200',
  },
  info: {
    icon: 'ℹ️',
    ring: 'border-sky-400/25',
    glow: 'from-sky-400/20 via-cyan-500/10 to-transparent',
    confirm: 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30',
    title: 'text-sky-200',
  },
};

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', variant = 'danger' }) {
  const v = variants[variant] || variants.danger;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.15s ease-out' }}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-3xl border bg-[#0d1117]/95 shadow-2xl backdrop-blur-2xl',
          v.ring,
        )}
        style={{ animation: 'slideUp 0.2s cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div className={cn('pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br blur-3xl', v.glow)} />
        <div className="relative p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-2xl">
              {v.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={cn('text-lg font-bold tracking-tight', v.title)}>{title}</h3>
              {message && <p className="mt-2 text-sm leading-6 text-white/55">{message}</p>}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={cn('rounded-xl px-4 py-2 text-sm font-semibold shadow-lg transition hover:opacity-90 active:scale-95', v.confirm)}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.97) } to { opacity: 1; transform: none } }
        `}</style>
      </div>
    </div>
  );
}
