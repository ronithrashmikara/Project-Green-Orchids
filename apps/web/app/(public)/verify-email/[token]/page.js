'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { AuthBackdrop, AuthCard, IconTile } from '@/components/auth/AuthUI';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await axios.post(`${API_URL}/auth/verify-email/${token}`);
        setStatus('success');
        setMessage('Your email has been verified successfully! Your account is now pending admin approval.');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. The link may have expired.');
      }
    })();
  }, [token]);

  return (
    <AuthBackdrop>
      <AuthCard className="p-8 text-center">
        {status === 'loading' ? (
          <>
            <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
            <p className="mt-5 text-sm text-white/55">Verifying your email…</p>
          </>
        ) : status === 'success' ? (
          <>
            <IconTile>✓</IconTile>
            <h2 className="mt-5 font-serif-display text-2xl text-white">Email verified</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">{message}</p>
            <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <IconTile tone="rose">✕</IconTile>
            <h2 className="mt-5 font-serif-display text-2xl text-white">Verification failed</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">{message}</p>
            <Link href="/register" className="mt-6 inline-flex rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Register again
            </Link>
          </>
        )}
      </AuthCard>
    </AuthBackdrop>
  );
}
