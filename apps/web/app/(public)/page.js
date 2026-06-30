'use client';

import Link from 'next/link';

const NAV = [
  { label: 'Catalogue', href: '/catalogue' },
  { label: 'Pricing', href: '/catalogue#pricing' },
  { label: 'RFQ', href: '/register' },
  { label: 'About', href: '#about' },
];

const FEATURES = [
  { title: 'Living catalogue', desc: 'Seasonal orchid availability with clear families, stock signals and trade-ready detail.' },
  { title: 'RFQ & tier pricing', desc: 'Submit multi-line RFQs and unlock Silver, Gold and Platinum buyer rules as volume grows.' },
  { title: 'Order to delivery', desc: 'Approvals, invoices, returns and delivery status — one polished trade workspace.' },
];

// A scatter of faint twinkling stars over the hero.
const STARS = [
  { top: '8%', left: '6%', d: '0s', s: 2 }, { top: '14%', left: '92%', d: '1.2s', s: 3 },
  { top: '22%', left: '40%', d: '2.1s', s: 2 }, { top: '10%', left: '70%', d: '0.6s', s: 2 },
  { top: '38%', left: '4%', d: '1.8s', s: 3 }, { top: '52%', left: '96%', d: '0.3s', s: 2 },
  { top: '30%', left: '54%', d: '2.6s', s: 2 }, { top: '6%', left: '30%', d: '1.5s', s: 2 },
  { top: '44%', left: '84%', d: '0.9s', s: 2 }, { top: '18%', left: '16%', d: '2.3s', s: 3 },
];

export default function LandingPage() {
  return (
    <main className="relative w-full bg-black text-white">
      {/* ================= HERO (full viewport) ================= */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
        {/* Video background */}
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          poster="/hero-poster.jpg"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        {/* Atmosphere overlays — gentle tint + soft vignette, with a smooth
            fade to black only at the very bottom so it hands off cleanly. */}
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/55 to-transparent" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 75% at 50% 38%, transparent 46%, rgba(0,0,0,0.5) 100%)' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-b from-transparent to-black" />

        {/* Twinkling stars */}
        {STARS.map((st, i) => (
          <span
            key={i}
            className="absolute z-[5] rounded-full bg-white"
            style={{
              top: st.top,
              left: st.left,
              width: st.s,
              height: st.s,
              opacity: 0.7,
              boxShadow: '0 0 6px 1px rgba(255,255,255,0.6)',
              animation: `twinkle 3.5s ease-in-out ${st.d} infinite`,
            }}
          />
        ))}

        {/* Glass pill navbar */}
        <header className="relative z-20 flex justify-center px-4 pt-6">
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
            <Link
              href="/login"
              className="ml-1 hidden rounded-full px-3.5 py-2 font-medium text-white/80 transition hover:text-white sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="glass-btn ml-1 rounded-full px-4 py-2 font-semibold text-white"
            >
              Apply
            </Link>
          </nav>
        </header>

        {/* Hero content — vertically centred in the remaining space */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
          <h1
            className="font-serif-display hero-rise font-medium leading-[0.9] text-white"
            style={{ fontSize: 'clamp(4rem, 17vw, 15rem)', textShadow: '0 6px 50px rgba(0,0,0,0.55)' }}
          >
            Orchids
          </h1>

          <p
            className="hero-rise mt-6 max-w-xl text-base font-light text-white/85 md:text-lg"
            style={{ animationDelay: '180ms', textShadow: '0 2px 18px rgba(0,0,0,0.6)' }}
          >
            A living wholesale catalogue of premium orchids — transparent trade pricing,
            RFQ workflows and order-to-delivery, all in one place.
          </p>

          <div className="hero-rise mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '320ms' }}>
            <Link
              href="/catalogue"
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90"
            >
              Browse catalogue
            </Link>
            <Link
              href="/register"
              className="glass-btn rounded-full px-7 py-3 text-sm font-semibold text-white"
            >
              Apply for trade access
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-center text-white/55">
          <div className="mx-auto h-9 w-5 rounded-full border border-white/40 p-1">
            <span className="mx-auto block h-2 w-1 animate-bounce rounded-full bg-white/70" />
          </div>
        </div>
      </section>

      {/* ================= Below the fold: dark feature band ================= */}
      <section id="about" className="relative z-10 bg-black px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-center text-emerald-300/90">Why trade with us</p>
          <h2 className="mt-3 text-center font-serif-display text-4xl font-medium text-white md:text-5xl">
            A complete wholesale operating room
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass-nav rounded-3xl p-7 text-left transition hover:-translate-y-1"
              >
                <h3 className="font-serif-display text-2xl font-medium text-white">{f.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center gap-5 text-center">
            <h3 className="max-w-2xl font-serif-display text-3xl font-medium text-white md:text-4xl">
              Bring buying, quoting, invoices &amp; delivery into one portal.
            </h3>
            <Link
              href="/register"
              className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90"
            >
              Apply for a trade account
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
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
            { h: 'Shop', links: [['Catalogue', '/catalogue'], ['Pricing', '/catalogue#pricing'], ['Request a quote', '/register']] },
            { h: 'Company', links: [['About', '#about'], ['Sign in', '/login'], ['Apply', '/register']] },
            { h: 'Support', links: [['Contact', 'mailto:trade@korchids.lk'], ['Trade terms', '#about'], ['Help centre', '#about']] },
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
            <Link href="#about" className="transition hover:text-white/70">Privacy</Link>
            <Link href="#about" className="transition hover:text-white/70">Terms</Link>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Trade desk open</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
