/**
 * RBAC middleware - require specific permission
 */
function requirePermission(...codes) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const hasPermission = codes.some(code => req.user.permissions.includes(code));
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Missing required permission: ${codes.join(' or ')}` },
      });
    }
    next();
  };
}

/**
 * Require one of the given roles
 */
function requireRole(...roleNames) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { query } = require('../config/db');
    const result = await query(
      `SELECT name FROM roles WHERE id = $1`,
      [req.user.roleId]
    );
    if (!result.rows.length) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Role not found' },
      });
    }

    if (!roleNames.includes(result.rows[0].name)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient role' },
      });
    }
    next();
  };
}

module.exports = { requirePermission, requireRole };
