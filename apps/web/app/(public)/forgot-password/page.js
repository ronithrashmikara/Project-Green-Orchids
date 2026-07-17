'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { AuthBackdrop, AuthCard, AuthInput, AuthButton, IconTile } from '@/components/auth/AuthUI';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setSent(true); // Always show success to prevent enumeration
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthBackdrop>
        <AuthCard className="p-8 text-center">
          <IconTile>✉</IconTile>
          <h2 className="mt-5 font-serif-display text-2xl text-white">Check your email</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            If an account exists with that email, we&apos;ve sent password reset instructions.
          </p>
          <Link href="/login" className="mt-6 inline-flex rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Back to sign in
          </Link>
        </AuthCard>
      </AuthBackdrop>
    );
  }

  return (
    <AuthBackdrop>
      <AuthCard className="p-8">
        <Link href="/" className="font-serif-display text-xl text-white">Orchids</Link>
        <h1 className="mt-5 font-serif-display text-3xl text-white">Forgot password</h1>
        <p className="mt-2 text-sm text-white/55">Enter your email and we&apos;ll send a reset link.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AuthInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <AuthButton type="submit" loading={loading} className="w-full">Send reset link</AuthButton>
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          <Link href="/login" className="font-medium text-emerald-300/90 transition hover:text-emerald-200">Back to sign in</Link>
        </p>
      </AuthCard>
    </AuthBackdrop>
  );
}
