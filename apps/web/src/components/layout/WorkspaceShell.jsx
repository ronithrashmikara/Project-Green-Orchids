'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Menu, X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

const workspaceConfig = {
  admin:     { label: 'Admin Suite',      accent: 'text-emerald-400', ring: 'bg-emerald-500', dot: 'bg-emerald-400' },
  buyer:     { label: 'Trade Portal',     accent: 'text-violet-400',  ring: 'bg-violet-500',  dot: 'bg-violet-400' },
  finance:   { label: 'Finance Desk',     accent: 'text-sky-400',     ring: 'bg-sky-500',     dot: 'bg-sky-400' },
  inventory: { label: 'Inventory Hub',    accent: 'text-amber-400',   ring: 'bg-amber-500',   dot: 'bg-amber-400' },
  delivery:  { label: 'Delivery Centre',  accent: 'text-orange-400',  ring: 'bg-orange-500',  dot: 'bg-orange-400' },
  sales:     { label: 'Sales Desk',       accent: 'text-teal-400',    ring: 'bg-teal-500',    dot: 'bg-teal-400' },
};

const COLLAPSE_KEY = 'orchids.sidebarCollapsed';

export function WorkspaceShell({
  children, navItems, pathname, user, logout, homeHref,
  workspace = 'admin', cartCount = 0, banner,
}) {
  const cfg = workspaceConfig[workspace] || workspaceConfig.admin;
  const active = (href) => pathname === href || pathname?.startsWith(`${href}/`);
  const initials = (user?.businessName || user?.name || user?.email || 'Orchids')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const displayName = user?.businessName || user?.name || user?.email || 'User';

  const { updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  /* Mobile drawer — closed by default, always closes on route change. */
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  /* Desktop collapse — persisted in localStorage, read after mount (SSR-safe). */
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
    } catch { /* storage unavailable (private mode etc.) — default expanded */ }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ avatarUrl: res.data?.data?.avatar_url });
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // avatarUrl from the API is a root-relative /uploads/... path, proxied straight through
  // by the /uploads/:path* rewrite in next.config.js (same-origin, no CORS headaches).
  const avatarSrc = user?.avatarUrl || null;

  const AvatarCircle = ({ size = 'h-9 w-9', textSize = 'text-xs' }) => (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploadingAvatar}
      title="Change profile picture"
      className={cn('group relative shrink-0 overflow-hidden rounded-xl', size)}
    >
      {avatarSrc ? (
        <img src={avatarSrc} alt={displayName} className={cn('h-full w-full object-cover rounded-xl', size)} />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center rounded-xl font-bold text-white', textSize, cfg.ring)}>
          {initials}
        </div>
      )}
      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
        {uploadingAvatar ? '…' : '📷'}
      </span>
    </button>
  );

  /* Sidebar body — shared by the desktop rail and the mobile drawer.
     navItems may contain plain links or `{ heading: '…' }` section markers. */
  const SidebarBody = ({ isCollapsed = false }) => (
    <>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 border-b border-slate-700/60 py-5', isCollapsed ? 'justify-center px-2' : 'px-5')}>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white', cfg.ring)}>O</div>
        {!isCollapsed && (
          <div>
            <p className="text-sm font-bold leading-none text-white tracking-tight">Orchids</p>
            <p className={cn('mt-0.5 text-[11px] font-semibold uppercase tracking-wider', cfg.accent)}>{cfg.label}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {navItems.map((item, idx) => {
          if (item.heading) {
            return isCollapsed ? (
              <div key={`heading-${idx}`} className="mx-2 my-3 border-t border-slate-700/60" title={item.heading} />
            ) : (
              <p key={`heading-${idx}`} className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 first:pt-1">
                {item.heading}
              </p>
            );
          }
          const isActive = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap',
                isCollapsed && 'justify-center px-0',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <span className={cn(
                'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[15px] transition-colors',
                isActive ? cn('text-white', cfg.ring) : 'bg-slate-800 group-hover:bg-slate-700',
              )}>
                {item.icon}
                {isCollapsed && item.badge && cartCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-bold text-white">{cartCount}</span>
                )}
              </span>
              {!isCollapsed && <span className="flex-1">{item.label}</span>}
              {!isCollapsed && item.badge && cartCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-[10px] font-bold text-white">{cartCount}</span>
              )}
              {!isCollapsed && isActive && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700/60 p-3">
        {isCollapsed ? (
          <div className="flex justify-center py-1">
            <AvatarCircle />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3">
            <AvatarCircle />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{displayName}</p>
              <button
                onClick={logout}
                className="text-[11px] font-medium text-slate-400 transition hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Skip link — first focusable element on the page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFile}
      />

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className={cn(
        'sticky top-0 hidden h-screen min-h-screen flex-col bg-slate-900 text-white transition-[width] duration-200 md:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}>
        <SidebarBody isCollapsed={collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'mx-3 mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* ── Mobile drawer + backdrop ────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm md:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-slate-900 text-white shadow-2xl transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
        <SidebarBody />
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className={cn('hidden h-2 w-2 shrink-0 rounded-full sm:block', cfg.dot)} />
              <Breadcrumbs rootLabel={cfg.label} rootHref={homeHref || '#'} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <AvatarCircle size="h-7 w-7" textSize="text-[10px]" />
              <span className="hidden text-[13px] text-slate-500 lg:block">
                Signed in as <span className="font-semibold text-slate-700">{displayName}</span>
              </span>
              <button
                onClick={logout}
                className="hidden rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:block"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {banner}

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-5 outline-none md:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
