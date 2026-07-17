'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { CONSENT_EVENT, getConsent, setConsent } from '@/lib/consent';

const CATEGORIES = [
  {
    key: 'necessary',
    label: 'Strictly necessary',
    locked: true,
    description:
      'Required for the site to work — signing in, keeping your session active and remembering your cart. These cannot be switched off.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    locked: false,
    description:
      'Help us understand how the platform is used (pages visited, features used) so we can improve it. Data is aggregated and never sold.',
  },
  {
    key: 'marketing',
    label: 'Marketing & preferences',
    locked: false,
    description:
      'Remember your preferences and let us show relevant trade offers. We do not share this data with third-party ad networks.',
  },
];

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        checked ? 'bg-emerald-600' : 'bg-slate-300',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false });

  // SSR-safe: only read the cookie after mount, and render nothing until then.
  useEffect(() => {
    setMounted(true);
    const stored = getConsent();
    if (stored) {
      setPrefs({ analytics: stored.analytics, marketing: stored.marketing });
    } else {
      setBannerOpen(true);
    }
  }, []);

  // Let any page re-open the preferences dialog (see openCookiePreferences()).
  useEffect(() => {
    const handler = () => {
      const stored = getConsent();
      if (stored) setPrefs({ analytics: stored.analytics, marketing: stored.marketing });
      setPrefsOpen(true);
    };
    window.addEventListener(CONSENT_EVENT, handler);
    return () => window.removeEventListener(CONSENT_EVENT, handler);
  }, []);

  const decide = (next) => {
    setConsent(next);
    setPrefs({ analytics: !!next.analytics, marketing: !!next.marketing });
    setBannerOpen(false);
    setPrefsOpen(false);
  };

  if (!mounted) return null;

  return (
    <>
      {bannerOpen && !prefsOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
          <div
            role="region"
            aria-label="Cookie consent"
            className="animate-slide-up mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-pop sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Cookie className="h-5 w-5" size={20} />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">We value your privacy</h2>
                <p className="mt-1 text-[13px] leading-5 text-slate-500">
                  We use cookies to keep the platform secure and, with your permission, to understand
                  how it is used and remember your preferences. See our{' '}
                  <Link href="/cookies" className="font-medium text-emerald-700 underline-offset-4 hover:underline">
                    Cookie Policy
                  </Link>{' '}
                  for details.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button variant="ghost" size="sm" onClick={() => setPrefsOpen(true)}>
                Manage preferences
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => decide({ analytics: false, marketing: false })}
              >
                Reject non-essential
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500"
                onClick={() => decide({ analytics: true, marketing: true })}
              >
                Accept all
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal open={prefsOpen} onClose={() => setPrefsOpen(false)} title="Cookie preferences" size="md">
        <p className="text-[13px] leading-5 text-slate-500">
          Choose which cookies we may use. Strictly necessary cookies are always on because the
          platform cannot function without them.
        </p>

        <div className="mt-5 space-y-4">
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {cat.label}
                  {cat.locked && <span className="ml-2 text-xs font-medium text-slate-400">Always on</span>}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-slate-500">{cat.description}</p>
              </div>
              <Toggle
                label={cat.label}
                checked={cat.locked ? true : prefs[cat.key]}
                disabled={cat.locked}
                onChange={(value) => setPrefs((p) => ({ ...p, [cat.key]: value }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => decide({ analytics: false, marketing: false })}
          >
            Reject non-essential
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500"
            onClick={() => decide(prefs)}
          >
            Save preferences
          </Button>
        </div>
      </Modal>
    </>
  );
}
