'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cartStore';
import { Spinner } from '@/components/ui/Spinner';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';

const navItems = [
  { href: '/buyer/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/buyer/catalogue', label: 'Catalogue', icon: '🌿' },
  { href: '/buyer/cart', label: 'Cart', icon: '🛒', badge: true },
  { href: '/buyer/rfq', label: 'RFQs', icon: '📋' },
  { href: '/buyer/orders', label: 'Orders', icon: '📦' },
  { href: '/buyer/invoices', label: 'Invoices', icon: '💰' },
  { href: '/buyer/returns', label: 'Returns', icon: '↩️' },
  { href: '/buyer/complaints', label: 'Complaints', icon: '💬' },
  { href: '/buyer/account', label: 'Account', icon: '⚙️' },
];

export default function BuyerLayout({ children }) {
  const { user, isLoading, logout } = useAuth();
  const { totalItems } = useCart();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'TRADE_BUYER')) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading) return <Spinner className="min-h-screen" />;
  if (!user) return null;

  if (user.status !== 'APPROVED' && pathname !== '/buyer/pending-approval') {
    router.push('/buyer/pending-approval');
    return null;
  }

  if (pathname === '/buyer/pending-approval') return children;

  return (
    <WorkspaceShell
      workspace="buyer"
      navItems={navItems}
      pathname={pathname}
      user={user}
      logout={logout}
      homeHref="/buyer/dashboard"
      title="Trade buyer workspace"
      subtitle={user.businessName || user.name || user.email}
      cartCount={totalItems}
      actions={
        <Link href="/buyer/cart" className="relative rounded-2xl border border-green-100 bg-white/80 px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-green-300 hover:text-green-800">
          🛒 Cart
          {totalItems > 0 && <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-green-700 text-[11px] text-white">{totalItems}</span>}
        </Link>
      }
      banner={user.hasOverdue ? <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-2 text-center text-sm font-semibold text-white shadow-sm">⚠ Your account has overdue invoices. Please settle them to maintain trading privileges.</div> : null}
    >
      {children}
    </WorkspaceShell>
  );
}
