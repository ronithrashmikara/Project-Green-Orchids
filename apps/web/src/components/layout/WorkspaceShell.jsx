'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

const workspaceStyles = {
  admin: { eyebrow: 'Admin Suite', glow: 'from-green-500/30 via-plum-500/20 to-orchid-500/25', logo: 'from-green-400 to-orchid-400', dot: 'bg-green-400' },
  buyer: { eyebrow: 'Trade Portal', glow: 'from-orchid-500/30 via-green-500/15 to-green-400/20', logo: 'from-orchid-400 to-green-400', dot: 'bg-orchid-400' },
  finance: { eyebrow: 'Finance Desk', glow: 'from-sky-500/30 via-green-500/15 to-orchid-400/20', logo: 'from-sky-400 to-green-400', dot: 'bg-sky-400' },
  inventory: { eyebrow: 'Inventory House', glow: 'from-green-500/30 via-amber-400/15 to-orchid-400/20', logo: 'from-green-400 to-amber-300', dot: 'bg-amber-400' },
  delivery: { eyebrow: 'Delivery Run', glow: 'from-orange-500/30 via-green-500/15 to-orchid-400/20', logo: 'from-orange-400 to-green-400', dot: 'bg-orange-400' },
};

export function WorkspaceShell({
  children, navItems, pathname, user, logout, homeHref,
  workspace = 'admin', title, subtitle, actions, cartCount = 0, banner, mobile = false,
}) {
  const style = workspaceStyles[workspace] || workspaceStyles.admin;
  const activeFor = (href) => pathname === href || pathname?.startsWith(`${href}/`);
  const initials = (user?.businessName || user?.name || user?.email || 'K')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div
      className={cn('min-h-screen bg-[#0a0a0c]', mobile ? 'flex flex-col md:flex-row' : 'flex')}
      style={{
        backgroundImage:
          'linear-gradient(rgba(8,8,10,0.82), rgba(8,8,10,0.92)), url(/dashboard-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <aside className={cn('relative overflow-hidden bg-[#0d0d10] text-white', mobile ? 'md:w-72 md:min-h-screen md:flex-col border-b border-white/5 md:border-b-0' : 'w-72 flex-col', 'flex')}>
        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-40', style.glow)} />

        <div className="relative hidden border-b border-white/10 p-5 md:block">
          <Link href={homeHref} className="group block">
            <span className="block font-serif-display text-2xl leading-none text-white">Orchids</span>
            <span className="eyebrow mt-1 block text-emerald-300/70">{style.eyebrow}</span>
          </Link>
        </div>

        <nav className={cn('relative flex-1 p-3 md:p-4', mobile ? 'flex gap-2 overflow-x-auto orchid-scrollbar md:flex-col md:gap-1.5 md:overflow-visible' : 'space-y-1.5')}>
          {navItems.map((item) => {
            const active = activeFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 py-3 text-sm font-bold transition-all duration-200',
                  active ? 'bg-white text-slate-900 shadow-pop' : 'text-white/65 hover:bg-white/10 hover:text-white'
                )}
              >
                <span className={cn('grid h-8 w-8 place-items-center rounded-xl text-base transition-colors',
                  active ? 'bg-gradient-to-br from-green-500 to-orchid-500 text-white' : 'bg-white/10 group-hover:bg-white/15')}>
                  {item.icon}
                </span>
                <span className={cn(mobile && 'hidden md:inline')}>{item.label}</span>
                {item.badge && cartCount > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-orchid-500 px-1.5 text-[11px] font-extrabold text-white">{cartCount}</span>
                )}
                {active && <span className="absolute right-3 hidden h-1.5 w-1.5 rounded-full bg-orchid-500 md:block" />}
              </Link>
            );
          })}
        </nav>

        <div className="relative hidden border-t border-white/10 p-4 md:block">
          <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10 backdrop-blur">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-green-500 to-orchid-500 text-sm font-extrabold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{user?.businessName || user?.name || user?.email}</p>
              <button onClick={logout} className="text-xs font-semibold text-white/50 transition hover:text-orchid-300">Sign out →</button>
            </div>
          </div>
        </div>
      </aside>

      <div className="portal-dark flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 px-4 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 animate-pulse rounded-full', style.dot)} />
                <p className="eyebrow text-emerald-300/70">{title || style.eyebrow}</p>
              </div>
              <h1 className="mt-1 truncate font-serif-display text-2xl text-white md:text-3xl">
                {subtitle || `Welcome, ${user?.businessName || user?.name || user?.email}`}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <button onClick={logout} className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 md:hidden">Exit</button>
            </div>
          </div>
        </header>

        {banner}

        <main className="flex-1 overflow-auto p-4 md:p-8 orchid-scrollbar">
          <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
