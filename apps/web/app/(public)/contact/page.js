'use client';

import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const CHANNELS = [
  { label: 'Trade desk', value: 'trade@orchids.lk', href: 'mailto:trade@orchids.lk' },
  { label: 'Phone', value: '+94 11 234 5678', href: 'tel:+94112345678' },
  { label: 'Address', value: 'Colombo, Sri Lanka', href: null },
];

export default function ContactPage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">Contact</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-6xl">Talk to the trade desk</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            Questions about applying for a trade account, an existing order, or bulk pricing on a specific
            variety — the trade desk handles all of it directly.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl gap-5 sm:grid-cols-3">
          {CHANNELS.map((c) => (
            <div key={c.label} className="glass-nav rounded-3xl p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{c.label}</p>
              {c.href ? (
                <a href={c.href} className="mt-2 block text-sm font-medium text-white transition hover:text-emerald-300">{c.value}</a>
              ) : (
                <p className="mt-2 text-sm font-medium text-white">{c.value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-left">
          <h2 className="font-serif-display text-2xl font-medium text-white">Already a trade buyer?</h2>
          <p className="mt-4 text-sm leading-6 text-white/65">
            Order-, invoice- and return-specific questions get answered fastest from inside your buyer
            portal — sign in and use the order or return detail page, which gives our team full context
            immediately.
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
