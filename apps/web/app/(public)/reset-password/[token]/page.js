'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { AuthBackdrop, AuthCard, AuthInput, AuthButton, IconTile } from '@/components/auth/AuthUI';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthBackdrop>
        <AuthCard className="p-8 text-center">
          <IconTile>✓</IconTile>
          <h2 className="mt-5 font-serif-display text-2xl text-white">Password reset</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">Your password has been successfully reset.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
            Sign in
          </Link>
        </AuthCard>
      </AuthBackdrop>
    );
  }

  return (
    <AuthBackdrop>
      <AuthCard className="p-8">
        <Link href="/" className="font-serif-display text-xl text-white">Orchids</Link>
        <h1 className="mt-5 font-serif-display text-3xl text-white">Set a new password</h1>
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-300">
            <p>{error}</p>
            <Link href="/forgot-password" className="mt-2 inline-block underline hover:text-rose-200">Request a new reset link</Link>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AuthInput label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <AuthInput label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <AuthButton type="submit" loading={loading} className="w-full">Reset password</AuthButton>
        </form>
      </AuthCard>
    </AuthBackdrop>
  );
}
