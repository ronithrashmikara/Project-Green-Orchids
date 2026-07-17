'use client';

import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';
import { openCookiePreferences } from '@/lib/consent';

const SECTIONS = [
  {
    title: 'What cookies are',
    body: 'Cookies are small text files stored on your device when you visit a website. They let the site remember things between pages and visits — like keeping you signed in or remembering the choices you have made. We only set first-party cookies; we do not load third-party advertising trackers.',
  },
  {
    title: 'Strictly necessary',
    body: 'These keep the platform working: signing you in, keeping your session secure and remembering your cart while you order. They are always on because the site cannot function without them, and they never track you across other websites.',
  },
  {
    title: 'Analytics',
    body: 'With your permission, these help us understand how the platform is used — which pages are visited and which features are used — so we can improve it. The data is aggregated and never sold or shared with advertisers.',
  },
  {
    title: 'Marketing & preferences',
    body: 'With your permission, these remember your preferences and let us show relevant trade offers when you are signed in. We do not share this data with third-party ad networks.',
  },
];

const COOKIE_TABLE = [
  { name: 'orchids_session', purpose: 'Keeps you signed in to your trade account.', duration: 'Session' },
  { name: 'orchids_cookie_consent', purpose: 'Records your cookie consent decision so we do not ask again.', duration: '180 days' },
  { name: 'orchids_cart', purpose: 'Remembers the items in your cart while you order.', duration: '30 days' },
  { name: 'orchids_analytics', purpose: 'Anonymous usage statistics (only set if you allow analytics).', duration: '12 months' },
];

export default function CookiesPage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">Legal</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-5xl">Cookie policy</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            What cookies Orchids uses, why we use them, and how to change your preferences at any time.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title} className="glass-nav rounded-2xl p-6 text-left">
              <h2 className="font-serif-display text-xl font-medium text-white">{s.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">{s.body}</p>
            </div>
          ))}

          <div className="glass-nav rounded-2xl p-6 text-left">
            <h2 className="font-serif-display text-xl font-medium text-white">Cookies we set</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                    <th className="py-2 pr-4 font-semibold">Name</th>
                    <th className="py-2 pr-4 font-semibold">Purpose</th>
                    <th className="py-2 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIE_TABLE.map((c) => (
                    <tr key={c.name} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pr-4 font-mono text-xs text-emerald-300/90">{c.name}</td>
                      <td className="py-3 pr-4 leading-6 text-white/65">{c.purpose}</td>
                      <td className="py-3 whitespace-nowrap text-white/65">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-nav rounded-2xl p-6 text-left">
            <h2 className="font-serif-display text-xl font-medium text-white">Changing your preferences</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              You can change your mind at any time. Reopen the preferences dialog below to allow or
              withdraw consent for analytics and marketing cookies — your choice is saved for 180 days.
              You can also clear cookies in your browser settings, which will show the consent banner again.
            </p>
            <button
              type="button"
              onClick={openCookiePreferences}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Manage cookie preferences
            </button>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-white/40">
          Last updated 2026. Contact the trade desk with any questions about cookies or privacy.
        </p>
      </section>

      <PublicFooter />
    </main>
  );
}
