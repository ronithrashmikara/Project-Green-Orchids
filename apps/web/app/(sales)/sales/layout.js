'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui/Spinner';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';

const navItems = [
  { href: '/sales/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/sales/approvals', label: 'Order approvals', icon: '✅' },
  { href: '/sales/complaints', label: 'Complaints', icon: '💬' },
  { href: '/sales/availability', label: 'Team availability', icon: '🟢' },
];

export default function SalesLayout({ children }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'SALES_MANAGER')) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading) return <Spinner className="min-h-screen" />;
  if (!user) return null;

  return (
    <WorkspaceShell
      workspace="sales"
      navItems={navItems}
      pathname={pathname}
      user={user}
      logout={logout}
      homeHref="/sales/dashboard"
      title="Sales operations"
      subtitle={`Sales desk · ${user.name || user.email}`}
    >
      {children}
    </WorkspaceShell>
  );
}
