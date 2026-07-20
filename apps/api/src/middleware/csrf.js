const env = require('../config/env');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set(['/api/payments/stripe/webhook']);

function allowedOrigins() {
  return new Set(
    String(env.CORS_ORIGIN || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin)
  );
}

// Mutation requests from the browser must carry a non-simple header and, when
// an Origin header is present, come from an explicitly configured origin.
// Cross-site forms cannot add X-Requested-With and cross-site scripts cannot
// pass CORS preflight, protecting the refresh cookie from CSRF.
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) return next();

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

  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ success: false, error: { code: 'CSRF_REJECTED', message: 'Missing CSRF request header' } });
  }
  return next();
}

module.exports = { csrfProtection };
