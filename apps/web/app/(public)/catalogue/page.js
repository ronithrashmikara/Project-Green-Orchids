'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Catalogue', href: '/catalogue', active: true },
  { label: 'Pricing', href: '/catalogue#pricing' },
  { label: 'RFQ', href: '/register' },
];

function stockInfo(stock) {
  if (stock == null) return { label: 'Made to order', dot: 'bg-white/40', text: 'text-white/55' };
  if (stock <= 0) return { label: 'Out of stock', dot: 'bg-rose-400', text: 'text-rose-300' };
  if (stock < 20) return { label: `Low · ${stock} left`, dot: 'bg-amber-400', text: 'text-amber-300' };
  return { label: 'In stock', dot: 'bg-emerald-400', text: 'text-emerald-300' };
}

function ProductTile({ p }) {
  const s = stockInfo(p.stock);
  return (
    <div className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
      <div className="relative aspect-square overflow-hidden">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-900/40 via-black to-pink-900/30">
            <span className="font-serif-display text-7xl text-white/15">{(p.name || 'O').charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
        {p.tier && (
          <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
            {p.tier}
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
          {p.sku || p.type || 'ORCHID'}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate font-serif-display text-lg text-white">{p.name}</h3>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">{p.category || p.type}</p>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={`flex items-center gap-1.5 font-medium ${s.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
          </span>
          {p.moq > 1 && <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/50">MOQ {p.moq}</span>}
        </div>

        <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs font-medium text-emerald-300/80">
          Sign in to view wholesale pricing
        </p>

        <Link
          href="/login"
          className="block rounded-full bg-white py-2.5 text-center text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Sign in to order
        </Link>
      </div>
    </div>
  );
}

export default function CataloguePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', category: '', search: '' });
  const [types, setTypes] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const api = (await import('@/lib/api')).default;
        const params = new URLSearchParams();
        if (filters.type) params.set('type', filters.type);
        if (filters.category) params.set('category', filters.category);
        if (filters.search) params.set('search', filters.search);
        const res = await api.get(`/products/catalogue?${params}`);
        setProducts(res.data.products || res.data.data || res.data);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters]);

  useEffect(() => {
    (async () => {
      try {
        const api = (await import('@/lib/api')).default;
        const r = await api.get('/products/types-and-categories');
        setTypes(r.data.types || []);
        setCategories(r.data.categories || []);
      } catch {}
    })();
  }, []);

  const selectClass =
    'w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 [&>option]:bg-neutral-900';

  return (
    <main className="relative min-h-screen w-full bg-black text-white">
      {/* ---------- Glass pill navbar ---------- */}
      <header className="sticky top-0 z-30 flex justify-center px-4 pb-4 pt-6">
        <nav className="glass-nav flex items-center gap-1 rounded-full p-1.5 pl-5 text-sm text-white/90">
          <Link href="/" className="mr-3 font-serif-display text-lg leading-none text-white" aria-label="Orchids home">
            Orchids
          </Link>
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={`hidden rounded-full px-3.5 py-2 font-medium transition sm:block ${
                n.active ? 'bg-white/10 text-white' : 'text-white/80 hover:text-white'
              }`}
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

      {/* ---------- Catalogue header ---------- */}
      <section className="relative overflow-hidden px-4 pb-12 pt-8 md:pt-12">
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              'radial-gradient(40rem 26rem at 12% 0%, rgba(16,185,129,0.16), transparent 60%), radial-gradient(40rem 26rem at 88% 8%, rgba(236,72,153,0.16), transparent 60%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <p className="eyebrow text-emerald-300/80">Public catalogue</p>
          <h1 className="mt-3 max-w-3xl font-serif-display text-5xl leading-[1.02] text-white md:text-7xl">
            Seasonal orchids, ready for wholesale planning.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/55 md:text-lg">
            Browse live availability before signing in. Approved trade buyers unlock tier pricing,
            cart actions and RFQ tools inside the portal.
          </p>
        </div>
      </section>

      {/* ---------- Filters ---------- */}
      <div className="mx-auto max-w-7xl px-4">
        <div className="glass-nav rounded-3xl p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px_auto] md:items-end">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">Search</label>
              <input
                placeholder="Search products, SKU, species…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">Type</label>
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className={selectClass}>
                <option value="">All types</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">Category</label>
              <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className={selectClass}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={() => setFilters({ type: '', category: '', search: '' })}
              className="glass-btn rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Product grid ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-white/50">
            {loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] py-20 text-center">
            <p className="font-serif-display text-2xl text-white">No products found</p>
            <p className="mt-2 text-sm text-white/50">Try adjusting your filters or reset to see everything.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => <ProductTile key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center md:p-14">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(30rem 18rem at 50% 0%, rgba(16,185,129,0.14), transparent 70%)' }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-serif-display text-3xl text-white md:text-4xl">
              Unlock wholesale pricing &amp; RFQ tools.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/55">
              Apply for a trade account to see tier pricing, build carts and submit multi-line RFQs.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
                Apply for trade access
              </Link>
              <Link href="/login" className="glass-btn rounded-full px-7 py-3 text-sm font-semibold text-white">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="relative z-10 border-t border-white/10 bg-black px-6 pb-10 pt-16">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="font-serif-display text-3xl text-white">Orchids</p>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">
              Premium orchid wholesale — a living catalogue, transparent trade pricing and a
              complete order-to-delivery portal.
            </p>
            <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90">
              Apply for trade access <span aria-hidden>→</span>
            </Link>
          </div>
          {[
            { h: 'Shop', links: [['Catalogue', '/catalogue'], ['Pricing', '/catalogue#pricing'], ['Request a quote', '/register']] },
            { h: 'Company', links: [['About', '/#about'], ['Sign in', '/login'], ['Apply', '/register']] },
            { h: 'Support', links: [['Contact', 'mailto:trade@korchids.lk'], ['Trade terms', '/#about'], ['Help centre', '/#about']] },
          ].map((col) => (
            <div key={col.h}>
              <p className="eyebrow text-emerald-300/80">{col.h}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-white/60 transition hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 text-xs font-medium text-white/40 sm:flex-row">
          <span>© {new Date().getFullYear()} ORCHIDS Wholesale · Colombo, Sri Lanka</span>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Trade desk open</span>
        </div>
      </footer>
    </main>
  );
}
