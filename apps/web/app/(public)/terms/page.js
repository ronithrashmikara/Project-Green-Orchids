'use client';

import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const SECTIONS = [
  {
    title: 'Eligibility',
    body: 'Orchids is a business-to-business wholesale platform. Access to wholesale pricing, cart checkout and RFQs is limited to trade accounts that have been reviewed and approved by our admin team; the public catalogue is available to anyone without pricing shown.',
  },
  {
    title: 'Orders',
    body: 'Submitting an order is an offer to purchase at the price and quantity shown at checkout, subject to admin approval and stock availability. An order is not confirmed until it is approved — approval reserves the stock against your order.',
  },
  {
    title: 'Pricing & price changes',
    body: 'Prices displayed are wholesale prices for approved trade accounts, inclusive of any tier discount and quantity-break pricing applicable to your account. Prices may change between browsing and checkout; you will be shown any difference before your order is submitted.',
  },
  {
    title: 'Payment',
    body: 'Payment terms (prepaid, Net 30 or Net 60) are set on your account at approval. Invoices are due by the date shown; late payment may affect your account\'s credit standing and future order approvals.',
  },
  {
    title: 'Cancellations & returns',
    body: 'Orders can be cancelled only while still pending payment, per the order\'s status. Returns must be requested within the return window shown on a delivered order and are subject to inspection before any credit is issued.',
  },
  {
    title: 'Account suspension',
    body: 'We reserve the right to suspend or close a trade account for non-payment, policy violations, or fraudulent activity. Suspension revokes active sessions and blocks new orders until the account is reinstated.',
  },
  {
    title: 'Limitation of liability',
    body: 'We aim for the catalogue and stock levels shown to be accurate, but availability can change quickly with live demand. Our liability for any order is limited to the value of that order.',
  },
];

export default function TermsPage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">Legal</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-5xl">Terms of service</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            The terms that apply to using the Orchids wholesale platform, in addition to our trade terms
            for approved buyers.
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
          Last updated 2026. See also our <a href="/trade-terms" className="underline hover:text-white/70">trade terms</a> and{' '}
          <a href="/privacy" className="underline hover:text-white/70">privacy policy</a>.
        </p>
      </section>

      <PublicFooter />
    </main>
  );
}
