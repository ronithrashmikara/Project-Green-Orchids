'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, size = 'md', className }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;

    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        // Minimal focus trap: keep Tab cycling inside the dialog.
        const focusables = panelRef.current.querySelectorAll(FOCUSABLE);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);

    // Body scroll lock.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Initial focus: first focusable element, else the panel itself.
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector(FOCUSABLE);
      (el || panelRef.current)?.focus?.();
    }, 0);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in fixed inset-0 bg-slate-950/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        tabIndex={-1}
        className={cn('animate-slide-up relative max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white shadow-pop outline-none', sizes[size], className)}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4.5 w-4.5" size={18} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
