'use client';

import Link from 'next/link';
import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const FAQS = [
  { q: 'How do I get a trade account?', a: 'Apply from the "Apply" link — fill in your business details and password. You\'ll get an email with a verification code; once verified, our admin team reviews and approves the account (usually within one business day) and assigns your tier, credit limit and payment term.' },
  { q: 'Why can\'t I see prices on the public catalogue?', a: 'Wholesale pricing is only shown to signed-in, approved trade accounts — it\'s a standard B2B protection so pricing isn\'t visible to anyone browsing the public site.' },
  { q: 'What\'s the difference between adding to cart and submitting an RFQ?', a: 'Cart checkout uses standard wholesale + tier pricing for in-stock quantities. An RFQ is for a custom quantity or negotiated price — submit one from your buyer portal and our team will send back a quote.' },
  { q: 'How do partial payments work?', a: 'You can record more than one payment against an invoice. The balance decreases with each payment, and the invoice is only marked paid once the balance reaches exactly zero.' },
  { q: 'I forgot my password — what do I do?', a: 'Use "Sign in" then "Forgot password" to request a reset link by email. The link is single-use and expires after an hour; if it expires, request a new one from the same page.' },
  { q: 'How do I request a return?', a: 'Open the delivered order from your Orders page and use the return request option, within the return window shown on that order. Our team reviews it and lets you know the outcome.' },
];

export default function HelpCentrePage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">Support</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-5xl">Help centre</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            Answers to the questions trade buyers ask most. Can't find what you need? The trade desk is a
            message away.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="glass-nav rounded-2xl p-6 text-left">
              <h2 className="font-serif-display text-lg font-medium text-white">{f.q}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-5 text-center">
          <h3 className="font-serif-display text-2xl font-medium text-white">Still stuck?</h3>
          <Link href="/contact" className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90">
            Contact the trade desk
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
