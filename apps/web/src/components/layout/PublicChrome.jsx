'use client';

import Link from 'next/link';

const NAV = [
  { label: 'Catalogue', href: '/catalogue' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'RFQ', href: '/register' },
  { label: 'About', href: '/about' },
];

export function PublicNav() {
  return (
    <header className="sticky top-0 z-30 flex justify-center px-4 pb-4 pt-6">
      <nav className="glass-nav flex items-center gap-1 rounded-full p-1.5 pl-5 text-sm text-white/90">
        <Link href="/" className="mr-3 font-serif-display text-lg leading-none text-white" aria-label="Orchids home">
          Orchids
        </Link>
        {NAV.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            className="hidden rounded-full px-3.5 py-2 font-medium text-white/80 transition hover:text-white sm:block"
          >
            {n.label}
          </Link>
        ))}
        <Link href="/login" className="ml-1 hidden rounded-full px-3.5 py-2 font-medium text-white/80 transition hover:text-white sm:block">
          Sign in
        </Link>
        <Link href="/register" className="glass-btn ml-1 rounded-full px-4 py-2 font-semibold text-white">
          Apply
        </Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="relative z-10 overflow-hidden border-t border-white/10 bg-black px-6 pb-10 pt-16">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-serif-display text-3xl text-white">Orchids</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">
            Premium orchid wholesale — a living catalogue, transparent trade pricing
            and a complete order-to-delivery portal.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Apply for trade access
            <span aria-hidden>→</span>
          </Link>
        </div>

        {[
          { h: 'Shop', links: [['Catalogue', '/catalogue'], ['Pricing', '/pricing'], ['Request a quote', '/register']] },
          { h: 'Company', links: [['About', '/about'], ['Sign in', '/login'], ['Apply', '/register']] },
          { h: 'Support', links: [['Contact', '/contact'], ['Trade terms', '/trade-terms'], ['Help centre', '/help-centre']] },
        ].map((col) => (
          <div key={col.h}>
            <p className="eyebrow text-emerald-300/80">{col.h}</p>
            <ul className="mt-4 space-y-3">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/60 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 text-xs font-medium text-white/40 sm:flex-row">
        <span>© {new Date().getFullYear()} ORCHIDS Wholesale · Colombo, Sri Lanka</span>
        <span className="flex items-center gap-6">
          <Link href="/privacy" className="transition hover:text-white/70">Privacy</Link>
          <Link href="/terms" className="transition hover:text-white/70">Terms</Link>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Trade desk open</span>
        </span>
      </div>
    </footer>
  );
}
