'use client';

export function AuthInput({ label, className = '', ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">{label}</span>
      <input
        {...props}
        className={`w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/35 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 ${className}`}
      />
    </label>
  );
}

export function AuthTextarea({ label, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">{label}</span>
      <textarea
        {...props}
        rows={props.rows || 3}
        className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/35 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20"
      />
    </label>
  );
}

export function AuthButton({ children, loading, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />}
      {children}
    </button>
  );
}

export function AuthBackdrop({ children, wide = false }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(40rem 24rem at 15% 8%, rgba(16,185,129,0.16), transparent 60%), radial-gradient(40rem 24rem at 85% 18%, rgba(236,72,153,0.16), transparent 60%)',
        }}
      />
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>{children}</div>
    </main>
  );
}

export function AuthCard({ children, className = '' }) {
  return <div className={`glass-nav rounded-3xl ${className}`}>{children}</div>;
}

export function IconTile({ children, tone = 'emerald' }) {
  const tones = {
    emerald: 'from-emerald-400/20 to-emerald-400/5 text-emerald-300 ring-emerald-400/20',
    rose: 'from-rose-400/20 to-rose-400/5 text-rose-300 ring-rose-400/20',
  };
  return (
    <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ring-1 ${tones[tone]}`}>
      {children}
    </div>
  );
}
