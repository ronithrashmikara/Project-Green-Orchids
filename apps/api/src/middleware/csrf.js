const env = require('../config/env');
const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set(['/api/payments/stripe/webhook']);
const CSRF_COOKIE_NAME = 'xsrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

function signToken(nonce) {
  return crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(nonce)
    .digest('base64url');
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createCsrfToken() {
  const nonce = crypto.randomBytes(32).toString('base64url');
  return `${nonce}.${signToken(nonce)}`;
}

function isValidCsrfToken(token) {
  const [nonce, signature] = String(token || '').split('.');
  if (!nonce || !signature) return false;
  return timingSafeEqual(signature, signToken(nonce));
}

function setCsrfCookie(res, token = createCsrfToken()) {
  res.cookie('xsrf_token', token, {
    httpOnly: false,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
  });
  return token;
}

function getOrSetCsrfToken(req, res) {
  const existingToken = req.cookies?.xsrf_token;
  if (isValidCsrfToken(existingToken)) return existingToken;
  return setCsrfCookie(res);
}

function allowedOrigins() {
  return new Set(
    String(env.CORS_ORIGIN || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin)
  );
}

function issueCsrfToken(req, res) {
  const csrfToken = getOrSetCsrfToken(req, res);
  res.json({ success: true, csrfToken });
}

// Mutation requests from the browser must carry a signed double-submit CSRF
// token in both a same-site cookie and a non-simple header. When an Origin
// header is present, it must also come from an explicitly configured origin.
// Cross-site forms cannot add X-Requested-With or X-CSRF-Token, and cross-site
// scripts cannot pass CORS preflight, protecting the refresh cookie from CSRF.
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    getOrSetCsrfToken(req, res);
    return next();
  }
  if (EXEMPT_PATHS.has(req.path)) return next();

  const origin = req.get('Origin');
  if (origin) {
    let normalizedOrigin;
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      return res.status(403).json({ success: false, error: { code: 'CSRF_REJECTED', message: 'Invalid request origin' } });
    }
    if (!allowedOrigins().has(normalizedOrigin)) {
      return res.status(403).json({ success: false, error: { code: 'CSRF_REJECTED', message: 'Request origin is not allowed' } });
    }
  }

  const cookieToken = req.cookies?.xsrf_token;
  const headerToken = req.get(CSRF_HEADER_NAME) || req.get('X-XSRF-TOKEN');
  if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken) || !isValidCsrfToken(cookieToken)) {
    return res.status(403).json({ success: false, error: { code: 'CSRF_REJECTED', message: 'Missing or invalid CSRF token' } });
  }

  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ success: false, error: { code: 'CSRF_REJECTED', message: 'Missing CSRF request header' } });
  }
  return next();
}

module.exports = { csrfProtection, issueCsrfToken };
