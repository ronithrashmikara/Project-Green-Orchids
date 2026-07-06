import Link from 'next/link';

export const metadata = {
  title: 'Page not found - Orchids',
};

export default function NotFound() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-4 text-center text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(36rem 22rem at 20% 10%, rgba(16,185,129,0.18), transparent 60%), radial-gradient(34rem 20rem at 80% 90%, rgba(236,72,153,0.14), transparent 60%)',
        }}
      />
      <div className="glass-nav relative w-full max-w-md rounded-3xl p-10">
        <Link href="/" className="font-serif-display text-2xl text-white">Orchids</Link>
        <p className="mt-8 font-serif-display text-7xl text-white">404</p>
        <h1 className="mt-4 font-serif-display text-2xl text-white">This page has wilted away</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          We couldn't find the page you were looking for. It may have been moved or no longer exists.
        </p>
        <Link
          href="/"
          className="glass-btn mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white"
        >
          Back to home →
        </Link>
      </div>
    </div>
  );
}
