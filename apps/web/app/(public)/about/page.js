'use client';

import Link from 'next/link';
import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const VALUES = [
  { title: 'Living catalogue', desc: 'Seasonal orchid availability tracked in real time, so what you see is what a supplier can actually deliver.' },
  { title: 'Transparent trade terms', desc: 'Tiered pricing, published MOQs and clear credit terms — no back-and-forth to find out what something really costs.' },
  { title: 'One workspace, start to finish', desc: 'RFQs, approvals, invoices, returns and delivery tracking live in a single portal built for repeat wholesale buying.' },
];

export default function AboutPage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow text-emerald-300/90">About Orchids</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-6xl">
            A wholesale desk built around the flower, not just the order.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/70">
            Orchids is a B2B wholesale platform for florists, event decorators and retail partners buying
            orchids, growing supplies and fertilizer at trade volume. We built it because sourcing orchids
            at scale usually means scattered price lists, phone-tag quotes and no visibility into what's
            actually in stock — so we put the whole trade relationship in one place instead.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="glass-nav rounded-3xl p-7 text-left transition hover:-translate-y-1">
              <h3 className="font-serif-display text-xl font-medium text-white">{v.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">{v.desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-20 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-left">
          <h2 className="font-serif-display text-2xl font-medium text-white">Where we operate</h2>
          <p className="mt-4 text-sm leading-6 text-white/65">
            We work with a network of orchid growers and horticultural suppliers across Sri Lanka, serving
            trade buyers from Colombo and the surrounding region. Every account is reviewed and approved by
            our admin team before it goes live, and every order is backed by real stock — reserved the
            moment it's approved, never oversold.
          </p>
        </div>

        <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-5 text-center">
          <h3 className="font-serif-display text-3xl font-medium text-white">Ready to see trade pricing?</h3>
          <Link href="/register" className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90">
            Apply for a trade account
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
