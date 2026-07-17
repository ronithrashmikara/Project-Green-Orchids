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

function requireAllPermissions(...codes) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const missing = codes.filter(code => !req.user.permissions.includes(code));
    if (missing.length) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Missing required permission: ${missing.join(' and ')}` },
      });
    }
    next();
  };
}

/**
 * Require one of the given roles
 */
function requireRole(...roleNames) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!roleNames.includes(req.user.roleName)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient role' },
      });
    }
    next();
  };
}

module.exports = { requirePermission, requireAllPermissions, requireRole };
