'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AuthBackdrop, AuthCard, AuthInput, AuthButton, IconTile } from '@/components/auth/AuthUI';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/verify-email`, { email, code });
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return toast.error('Enter your email first');
    setResending(true);
    try {
      await axios.post(`${API_URL}/auth/verify-email/resend`, { email });
      toast.success('A new code has been sent');
    } catch {
      toast.success('A new code has been sent'); // don't reveal account existence
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <AuthBackdrop>
        <AuthCard className="p-8 text-center">
          <IconTile>✓</IconTile>
          <h2 className="mt-5 font-serif-display text-2xl text-white">Email verified</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Your account is now pending admin approval. You&apos;ll be able to sign in and access the trade portal once approved.
          </p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
            Go to sign in
          </Link>
        </AuthCard>
      </AuthBackdrop>
    );
  }

  return (
    <AuthBackdrop>
      <AuthCard className="p-8">
        <Link href="/" className="font-serif-display text-xl text-white">Orchids</Link>
        <h1 className="mt-5 font-serif-display text-3xl text-white">Verify your email</h1>
        <p className="mt-2 text-sm text-white/55">
          Enter the 6-digit code we sent to your email address. It expires in 15 minutes.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AuthInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <AuthInput
            label="Verification code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="tracking-[0.5em] text-center text-lg"
            required
          />
          <AuthButton type="submit" loading={loading} disabled={code.length !== 6} className="w-full">
            Verify email
          </AuthButton>
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          Didn&apos;t get a code?{' '}
          <button type="button" onClick={handleResend} disabled={resending} className="font-medium text-emerald-300/90 transition hover:text-emerald-200 disabled:opacity-50">
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </p>
        <p className="mt-2 text-center text-sm text-white/50">
          <Link href="/login" className="font-medium text-emerald-300/90 transition hover:text-emerald-200">Back to sign in</Link>
        </p>
      </AuthCard>
    </AuthBackdrop>
  );
}
