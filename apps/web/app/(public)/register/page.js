'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthBackdrop, AuthCard, AuthInput, AuthTextarea, AuthButton, IconTile } from '@/components/auth/AuthUI';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ businessName: '', registrationNo: '', phone: '', address: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = (pw) => [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/register`, {
        businessName: form.businessName,
        businessRegNo: form.registrationNo,
        registrationNo: form.registrationNo,
        phone: form.phone,
        address: form.address,
        email: form.email,
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthBackdrop>
        <AuthCard className="p-8 text-center">
          <IconTile>✉</IconTile>
          <h2 className="mt-5 font-serif-display text-2xl text-white">Check your email for a code</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            We&apos;ve sent a 6-digit verification code to {form.email}. Enter it to verify your account.
          </p>
          <button
            onClick={() => router.push(`/verify-email?email=${encodeURIComponent(form.email)}`)}
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Enter verification code
          </button>
        </AuthCard>
      </AuthBackdrop>
    );
  }

  const strength = passwordStrength(form.password);

  return (
    <AuthBackdrop wide>
      <AuthCard className="overflow-hidden">
        <div className="relative border-b border-white/10 px-8 py-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(28rem 14rem at 0% 0%, rgba(16,185,129,0.16), transparent 70%)' }}
          />
          <Link href="/" className="relative font-serif-display text-2xl text-white">Orchids</Link>
          <h1 className="relative mt-6 font-serif-display text-3xl text-white">Apply for a trade account</h1>
          <p className="relative mt-2 text-sm text-white/55">
            Tell us about your business so the admin team can review and activate your buyer workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-8 md:grid-cols-2">
          <AuthInput label="Business name" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} required />
          <AuthInput label="Business registration no" value={form.registrationNo} onChange={(e) => update('registrationNo', e.target.value)} required />
          <AuthInput label="Phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
          <AuthInput label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          <AuthTextarea label="Address" value={form.address} onChange={(e) => update('address', e.target.value)} required className="md:col-span-2" />
          <div>
            <AuthInput label="Password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
            {form.password && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= strength ? (strength <= 2 ? 'bg-rose-500' : strength === 3 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <AuthInput label="Confirm password" type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} required />
          <AuthButton type="submit" loading={loading} className="md:col-span-2">Submit application</AuthButton>
          <p className="text-center text-sm text-white/50 md:col-span-2">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-emerald-300/90 transition hover:text-emerald-200">Sign in</Link>
          </p>
        </form>
      </AuthCard>
    </AuthBackdrop>
  );
}
