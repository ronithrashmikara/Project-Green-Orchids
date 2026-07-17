const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const env = require('../config/env');
const { query } = require('../config/db');

// Kept as an exported compatibility surface for callers that explicitly bust
// user state. Authorization itself is intentionally loaded from PostgreSQL on
// every request so role/status changes take effect immediately.
const statusCache = new NodeCache({ stdTTL: 1, checkperiod: 1 });

function bearerToken(req) {
  const value = req.get('Authorization');
  if (typeof value !== 'string') return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(value);
  return match ? match[1] : null;
}

async function currentPrincipal(payload) {
  if (!payload?.sub || !payload?.iat) return null;
  const result = await query(
    `SELECT u.id, u.email, u.status, u.role_id, u.password_changed_at,
            r.name AS role_name,
            COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = $1
      GROUP BY u.id, u.email, u.status, u.role_id, u.password_changed_at, r.name`,
    [payload.sub]
  );
  if (!result.rows.length) return null;
  const user = result.rows[0];
  if (user.status !== 'ACTIVE') return { inactive: true, status: user.status };

  const issuedAtMs = Number.isFinite(payload.iat_ms) ? payload.iat_ms : payload.iat * 1000;
  if (!Number.isFinite(issuedAtMs)) return null;
  if (user.password_changed_at && issuedAtMs < new Date(user.password_changed_at).getTime()) {
    return { invalidated: true };
  }

  return {
    id: user.id,
    email: user.email,
    roleId: user.role_id,
    roleName: user.role_name,
    permissions: user.permissions,
  };
}

async function resolveToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  return currentPrincipal(payload);
}

async function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
  }
  try {
    const principal = await resolveToken(token);
    if (!principal) return res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    if (principal.inactive) {
      return res.status(403).json({ success: false, error: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' } });
    }
    if (principal.invalidated) {
      return res.status(401).json({ success: false, error: { code: 'TOKEN_INVALIDATED', message: 'Please sign in again' } });
    }
    req.user = principal;
    return next();
  } catch (err) {
    const expired = err?.name === 'TokenExpiredError';
    if (expired || err?.name === 'JsonWebTokenError' || err?.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        error: { code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN', message: expired ? 'Access token has expired' : 'Invalid access token' },
      });
    }
    return next(err);
  }
}

async function optionalAuth(req, _res, next) {
  const token = bearerToken(req);
  if (!token) return next();
  try {
    const principal = await resolveToken(token);
    if (principal && !principal.inactive && !principal.invalidated) req.user = principal;
  } catch (err) {
    if (!['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err?.name)) return next(err);
  }
  return next();
}

async function requireApprovedBuyer(req, res, next) {
  try {
    const result = await query('SELECT account_status FROM trade_accounts WHERE user_id = $1', [req.user.id]);
    if (!result.rows.length || !['APPROVED', 'ACTIVE'].includes(result.rows[0].account_status)) {
      return res.status(403).json({ success: false, error: { code: 'ACCOUNT_NOT_APPROVED', message: 'Trade account is not yet approved' } });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

function bustUserStatus(userId) {
  statusCache.del(`user_status_${userId}`);
}

module.exports = { requireAuth, optionalAuth, requireApprovedBuyer, bustUserStatus, statusCache, currentPrincipal };
