'use client';

import { useEffect, useState, useCallback } from 'react';
import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const STATUS_META = {
  operational: { label: 'Operational', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  degraded: { label: 'Degraded performance', dot: 'bg-amber-400', text: 'text-amber-300' },
  major_outage: { label: 'Major outage', dot: 'bg-rose-400', text: 'text-rose-300' },
  unknown: { label: 'Unknown', dot: 'bg-white/30', text: 'text-white/50' },
};

const OVERALL_COPY = {
  operational: 'All systems operational',
  degraded: 'Some systems degraded',
  major_outage: 'Major system outage',
};

const POLL_MS = 30000;

export default function StatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const startedAt = Date.now();
      const res = await fetch('/api/healthz', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      const health = await res.json();
      const latencyMs = Date.now() - startedAt;
      const healthy = health?.status === 'healthy';
      setData({
        overall: healthy ? 'operational' : 'major_outage',
        checkedAt: health?.timestamp || new Date().toISOString(),
        components: [
          { key: 'web', name: 'Web application', status: 'operational', latencyMs: 0 },
          { key: 'api', name: 'API server', status: healthy ? 'operational' : 'major_outage', latencyMs },
          { key: 'database', name: 'Database', status: healthy ? 'operational' : 'major_outage', latencyMs },
        ],
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  const overall = error ? 'major_outage' : data?.overall;
  const overallMeta = STATUS_META[overall] || STATUS_META.unknown;

  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">System status</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-6xl">
            Orchids platform status
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            Live checks against the web application, API and database that power the trade portal.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="glass-nav flex items-center justify-between rounded-3xl px-7 py-6">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                {!loading && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full ${overallMeta.dot} opacity-60`}
                  />
                )}
                <span className={`relative inline-flex h-3 w-3 rounded-full ${overallMeta.dot}`} />
              </span>
              <h2 className="font-serif-display text-xl font-medium text-white md:text-2xl">
                {loading ? 'Checking systems…' : error ? 'Unable to reach status API' : OVERALL_COPY[overall]}
              </h2>
            </div>
            {data?.checkedAt && (
              <span className="hidden text-xs font-medium text-white/45 sm:block">
                Last checked {new Date(data.checkedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            {(data?.components || FALLBACK_COMPONENTS).map((c) => {
              const meta = STATUS_META[error ? 'unknown' : c.status] || STATUS_META.unknown;
              return (
                <div key={c.key} className="flex items-center justify-between gap-4 px-7 py-5">
                  <span className="text-sm font-medium text-white/90">{c.name}</span>
                  <div className="flex items-center gap-3">
                    {!error && !loading && c.key !== 'web' && (
                      <span className="hidden text-xs text-white/40 sm:block">{c.latencyMs}ms</span>
                    )}
                    <span className={`flex items-center gap-2 text-xs font-semibold ${meta.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {loading ? 'Checking…' : meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-white/35">
            This page polls our infrastructure every 30 seconds. It does not track historical incidents.
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

const FALLBACK_COMPONENTS = [
  { key: 'web', name: 'Web application' },
  { key: 'api', name: 'API server' },
  { key: 'database', name: 'Database' },
];
