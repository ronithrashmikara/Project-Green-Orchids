'use client';

import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const SECTIONS = [
  {
    title: 'What we collect',
    body: 'Business and contact details you provide when applying for a trade account (business name, registration number, phone, address, email); order, invoice, payment and return records tied to your account; and login/session metadata (IP address, device type, timestamps) used for account security.',
  },
  {
    title: 'How we use it',
    body: 'To operate your trade account — processing orders, invoices, payments and returns, verifying your identity at login, and sending transactional emails about your account and orders. We do not sell your data to third parties.',
  },
  {
    title: 'Payments',
    body: 'Card and payment processing is handled by our payment provider; we never store full card numbers on our servers. We keep only a payment reference and the amount/method recorded for your account.',
  },
  {
    title: 'Security',
    body: 'Passwords are hashed, never stored in plain text. Sessions are tracked so you can review and revoke device access from your account settings. Access to buyer data is restricted by account ownership — no buyer can view another buyer\'s orders, invoices or returns.',
  },
  {
    title: 'Data retention',
    body: 'Login and audit history is retained for a limited period for security purposes. Financial records (orders, invoices, payments) are retained for as long as your account is active, and as required by applicable accounting and tax regulations.',
  },
  {
    title: 'Your choices',
    body: 'You can review and update your business details from your account page at any time, and can sign out of any active session remotely. Contact the trade desk to request a copy of your account data or to close your account.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">Legal</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-5xl">Privacy policy</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            How Orchids collects, uses and protects your business and account information.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title} className="glass-nav rounded-2xl p-6 text-left">
              <h2 className="font-serif-display text-xl font-medium text-white">{s.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-white/40">
          Last updated 2026. Contact the trade desk with any privacy questions or requests.
        </p>
      </section>

      <PublicFooter />
    </main>
  );
}
