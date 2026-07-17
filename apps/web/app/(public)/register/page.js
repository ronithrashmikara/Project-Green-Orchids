'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { AuthBackdrop, AuthCard, AuthInput, AuthTextarea, AuthButton, IconTile } from '@/components/auth/AuthUI';

// Mirrors apps/api/src/modules/auth/auth.schema.js registerSchema exactly, so a form that
// passes here never gets rejected by the backend for a rule the user wasn't shown.
const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (pw) => pw.length >= 10 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{7,20}$/;
const BUSINESS_REG_NO_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{1,49}$/;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ businessName: '', registrationNo: '', phone: '', address: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const passwordRuleResults = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(form.password) }));
  const passwordValid = passwordRuleResults.every((r) => r.passed);
  const emailValid = EMAIL_REGEX.test(form.email);
  const phoneValid = PHONE_REGEX.test(form.phone);
  const regNoValid = BUSINESS_REG_NO_REGEX.test(form.registrationNo);
  const confirmValid = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const canSubmit = passwordValid && emailValid && phoneValid && regNoValid && confirmValid
    && form.businessName && form.address;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordValid) return toast.error('Password does not meet the requirements below');
    if (!emailValid) return toast.error('Enter a valid email address');
    if (!phoneValid) return toast.error('Enter a valid phone number');
    if (!regNoValid) return toast.error('Enter a valid business registration number');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/register', {
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
          <div>
            <AuthInput label="Business registration no" value={form.registrationNo} onChange={(e) => update('registrationNo', e.target.value)} required />
            {form.registrationNo && !regNoValid && (
              <p className="mt-1.5 text-xs text-rose-400">3-50 characters: letters, numbers, spaces, - or /</p>
            )}
          </div>
          <div>
            <AuthInput label="Phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
            {form.phone && !phoneValid && (
              <p className="mt-1.5 text-xs text-rose-400">Enter a valid phone number (7-20 digits, may include + - ( ) spaces)</p>
            )}
          </div>
          <div>
            <AuthInput label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            {form.email && !emailValid && (
              <p className="mt-1.5 text-xs text-rose-400">Enter a valid email address</p>
            )}
          </div>
          <AuthTextarea label="Address" value={form.address} onChange={(e) => update('address', e.target.value)} required className="md:col-span-2" />
          <div>
            <AuthInput label="Password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
            {form.password && (
              <div className="mt-2 flex gap-1">
                {passwordRuleResults.map((r, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${r.passed ? 'bg-emerald-400' : 'bg-white/10'}`}
                  />
                ))}
              </div>
            )}
            {form.password && (
              <ul className="mt-2 space-y-1">
                {passwordRuleResults.map((r, i) => (
                  <li key={i} className={`flex items-center gap-1.5 text-xs ${r.passed ? 'text-emerald-400' : 'text-white/40'}`}>
                    <span>{r.passed ? '✓' : '·'}</span> {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <AuthInput label="Confirm password" type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} required />
            {form.confirmPassword && !confirmValid && (
              <p className="mt-1.5 text-xs text-rose-400">Passwords do not match</p>
            )}
          </div>
          <AuthButton type="submit" loading={loading} disabled={!canSubmit} className="md:col-span-2">Submit application</AuthButton>
          <p className="text-center text-sm text-white/50 md:col-span-2">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-emerald-300/90 transition hover:text-emerald-200">Sign in</Link>
          </p>
        </form>
      </AuthCard>
    </AuthBackdrop>
  );
}
