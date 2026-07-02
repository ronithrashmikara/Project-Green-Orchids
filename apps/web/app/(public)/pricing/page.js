'use client';

import Link from 'next/link';
import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const TIERS = [
  { name: 'Silver', desc: 'Every approved trade account starts here.', points: ['Wholesale pricing on the full catalogue', 'Net 30 payment terms available', 'Standard MOQ per product'] },
  { name: 'Gold', desc: 'Unlocked as order volume grows.', points: ['Deeper per-line discount than Silver', 'Higher credit limit', 'Priority RFQ review'] },
  { name: 'Platinum', desc: 'Our highest-volume trade partners.', points: ['Best available discount rate', 'Highest credit limit', 'Priority stock allocation on low-availability lines'] },
];

export default function PricingPage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">Pricing</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-6xl">Wholesale, not retail</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            Every product carries a base wholesale price plus quantity-break pricing at higher volumes.
            Your buyer tier applies an additional discount on top of that — the more you buy over time,
            the better your standing rate. Exact prices are only shown to signed-in, approved trade accounts.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className="glass-nav rounded-3xl p-7 text-left transition hover:-translate-y-1">
              <h3 className="font-serif-display text-2xl font-medium text-white">{t.name}</h3>
              <p className="mt-2 text-sm text-white/60">{t.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {t.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm leading-6 text-white/70">
                    <span className="mt-1 text-emerald-300">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-left">
          <h2 className="font-serif-display text-2xl font-medium text-white">Need a custom quantity or price?</h2>
          <p className="mt-4 text-sm leading-6 text-white/65">
            Submit a multi-line RFQ from your buyer portal with a target price per item — our team reviews
            and quotes it directly, informed by your account's tier, standing and order history.
          </p>
        </div>

        <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-5 text-center">
          <h3 className="font-serif-display text-3xl font-medium text-white">See your wholesale price</h3>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90">
              Apply for a trade account
            </Link>
            <Link href="/catalogue" className="glass-btn rounded-full px-7 py-3 text-sm font-semibold text-white">
              Browse the catalogue
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
