// Cookie consent helpers — reads/writes the first-party consent cookie and
// mirrors it in localStorage. All functions are SSR-safe no-ops on the server.

export const CONSENT_COOKIE = 'orchids_cookie_consent';
export const CONSENT_EVENT = 'orchids:open-cookie-preferences';

const CONSENT_MAX_AGE_DAYS = 180;

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Returns the stored consent decision, or null if the visitor has not
 * decided yet. Shape: { necessary: true, analytics, marketing, timestamp }.
 */
export function getConsent() {
  if (typeof window === 'undefined') return null;
  const raw = readCookie(CONSENT_COOKIE) || window.localStorage.getItem(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return { necessary: true, analytics: !!parsed.analytics, marketing: !!parsed.marketing, timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}

/**
 * Persists a consent decision to the first-party cookie (180 days) and
 * mirrors it in localStorage. Returns the stored object.
 */
export function setConsent(prefs = {}) {
  if (typeof window === 'undefined') return null;
  const value = {
    necessary: true,
    analytics: !!prefs.analytics,
    marketing: !!prefs.marketing,
    timestamp: new Date().toISOString(),
  };
  const encoded = encodeURIComponent(JSON.stringify(value));
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${CONSENT_COOKIE}=${encoded}; max-age=${maxAge}; path=/; SameSite=Lax`;
  try {
    window.localStorage.setItem(CONSENT_COOKIE, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable (private mode) — cookie is the source of truth.
  }
  return value;
}

/** Removes the stored decision so the banner shows again on next mount. */
export function clearConsent() {
  if (typeof window === 'undefined') return;
  document.cookie = `${CONSENT_COOKIE}=; max-age=0; path=/; SameSite=Lax`;
  try {
    window.localStorage.removeItem(CONSENT_COOKIE);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Re-opens the cookie preferences dialog from anywhere in the app
 * (e.g. the "Manage cookie preferences" button on the Cookie Policy page).
 */
export function openCookiePreferences() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
}
