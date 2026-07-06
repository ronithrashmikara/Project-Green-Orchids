'use client';

import Link from 'next/link';

export default function Error({ error, reset }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-4 text-center text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(36rem 22rem at 20% 10%, rgba(236,72,153,0.16), transparent 60%), radial-gradient(34rem 20rem at 80% 90%, rgba(16,185,129,0.14), transparent 60%)',
        }}
      />
      <div className="glass-nav relative w-full max-w-md rounded-3xl p-10">
        <Link href="/" className="font-serif-display text-2xl text-white">Orchids</Link>
        <p className="mt-8 text-5xl">🥀</p>
        <h1 className="mt-4 font-serif-display text-2xl text-white">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          An unexpected error interrupted this page. You can try again, or head back to safety.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="glass-btn inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/80 transition hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
