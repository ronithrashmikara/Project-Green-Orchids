'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { AuthInput, AuthButton } from '@/components/auth/AuthUI';
import toast from 'react-hot-toast';

const HIGHLIGHTS = ['Live wholesale catalogue', 'RFQ & tier pricing', 'Order-to-delivery tracking'];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success('Welcome back!');
      switch (user.role) {
        case 'ADMIN': router.push('/admin/dashboard'); break;
        case 'TRADE_BUYER': user.status !== 'APPROVED' ? router.push('/buyer/pending-approval') : router.push('/buyer/dashboard'); break;
        case 'INVENTORY_MANAGER': router.push('/inventory/dashboard'); break;
        case 'FINANCE_OFFICER': router.push('/finance/dashboard'); break;
        case 'DELIVERY_COORDINATOR': router.push('/delivery/dashboard'); break;
        case 'SALES_MANAGER': router.push('/sales/dashboard'); break;
        default: router.push('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-black text-white lg:grid-cols-2">
      {/* Brand showcase */}
      <div className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/hero-poster.jpg)' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/85" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(36rem 22rem at 20% 90%, rgba(16,185,129,0.22), transparent 60%)' }}
        />
        <Link href="/" className="relative font-serif-display text-2xl text-white">Orchids</Link>

        <div className="relative">
          <p className="eyebrow text-emerald-300/80">Wholesale, rebuilt for trade teams</p>
          <h2 className="mt-4 font-serif-display text-5xl leading-[1.05] text-white">
            One portal for<br />the entire<br /><span className="italic text-emerald-300">order cycle.</span>
          </h2>
          <div className="mt-10 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <div key={h} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium text-white/85">{h}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-white/40">© {new Date().getFullYear()} Orchids Wholesale</p>
      </div>

      {/* Form */}
      <div className="relative grid place-items-center overflow-hidden px-5 py-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(34rem 20rem at 80% 0%, rgba(236,72,153,0.12), transparent 60%)' }}
        />
        <div className="relative w-full max-w-md">
          <Link href="/" className="mb-8 inline-block font-serif-display text-xl text-white lg:hidden">Orchids</Link>

          <p className="eyebrow text-emerald-300/80">Sign in</p>
          <h1 className="mt-2 font-serif-display text-4xl text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-white/55">Access the trade, admin, finance, inventory or delivery workspace.</p>

          {error && (
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <AuthInput label="Email" type="email" placeholder="you@business.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <AuthInput label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm font-medium text-emerald-300/90 transition hover:text-emerald-200">Forgot password?</Link>
            </div>
            <AuthButton type="submit" loading={loading} className="w-full">Sign in →</AuthButton>
          </form>

          <p className="mt-8 text-center text-sm text-white/50">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-emerald-300/90 transition hover:text-emerald-200">Apply for trade access</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
