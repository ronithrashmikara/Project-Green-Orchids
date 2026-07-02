const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const env = require('../config/env');
const { query } = require('../config/db');

// 30-second in-memory cache for user status checks
const statusCache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

/**
 * Verify JWT access token and attach user to request
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
      });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' },
        });
      }
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
      });
    }

    // Check user status + password-change-invalidation cache
    const cacheKey = `user_status_${payload.sub}`;
    let cached = statusCache.get(cacheKey);

    if (!cached) {
      const result = await query(
        'SELECT id, email, status, role_id, password_changed_at FROM users WHERE id = $1',
        [payload.sub]
      );
      if (!result.rows.length) {
        return res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }
      const user = result.rows[0];
      cached = { status: user.status, passwordChangedAt: user.password_changed_at };
      statusCache.set(cacheKey, cached);
    }

    if (cached.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: `Account is ${cached.status.toLowerCase()}` },
      });
    }

    // A password reset/change must kill access tokens issued before it, not
    // just refresh tokens/sessions (F4.1) — otherwise a stolen 15-minute
    // access token keeps working straight through a reset meant to revoke it.
    if (payload.iat && cached.passwordChangedAt && payload.iat * 1000 < new Date(cached.passwordChangedAt).getTime()) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALIDATED', message: 'Password was changed after this token was issued; please sign in again' },
      });
    }

    // Load permissions from role
    const permResult = await query(
      `SELECT p.code FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [payload.role_id]
    );

    req.user = {
      id: payload.sub,
      email: payload.email,
      roleId: payload.role_id,
      permissions: permResult.rows.map(r => r.code),
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: 'Authentication error' },
    });
  }
}

/**
 * Optional auth - doesn't fail if no token
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      const permResult = await query(
        `SELECT p.code FROM permissions p
         INNER JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = $1`,
        [payload.role_id]
      );
      req.user = {
        id: payload.sub,
        email: payload.email,
        roleId: payload.role_id,
        permissions: permResult.rows.map(r => r.code),
      };
    } catch (_) {
      // Token invalid, continue without auth
    }
    next();
  } catch (err) {
    next();
  }
}

/**
 * Require approved trade account for buyer routes
 */
async function requireApprovedBuyer(req, res, next) {
  try {
    const result = await query(
      `SELECT account_status FROM trade_accounts WHERE user_id = $1`,
      [req.user.id]
    );
    const approvedStatuses = ['APPROVED', 'ACTIVE'];
    if (!result.rows.length || !approvedStatuses.includes(result.rows[0].account_status)) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_APPROVED', message: 'Trade account is not yet approved' },
      });
    }
    next();
  } catch (err) {
    console.error('Buyer approval check error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify account status' },
    });
  }
}

/**
 * Bust the cached status for a user so suspend/lock/deactivate takes effect
 * immediately on this instance instead of waiting up to 30s (Finding 18 / F4.1).
 */
function bustUserStatus(userId) {
  statusCache.del(`user_status_${userId}`);
}

module.exports = { requireAuth, optionalAuth, requireApprovedBuyer, bustUserStatus, statusCache };
