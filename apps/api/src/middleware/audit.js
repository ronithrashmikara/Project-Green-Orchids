const { query } = require('../config/db');

// Recursive, regex-aware redaction (Finding 19 / F4.2). The previous version only
// stripped a fixed set of TOP-LEVEL keys; nested objects and any key matching
// /secret|token|password|hash/i now get redacted too.
const REDACT_RE = /secret|token|password|hash|api[_-]?key/i;

function redactSensitive(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);
  if (Array.isArray(obj)) {
    const result = obj.map(v => redactSensitive(v, seen));
    seen.delete(obj);
    return result;
  }
  const result = Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => !['__proto__', 'prototype', 'constructor'].includes(key))
      .map(([key, value]) => [
        key,
        REDACT_RE.test(key) ? '[REDACTED]' : redactSensitive(value, seen),
      ])
  );
  seen.delete(obj);
  return result;
}

// audit_logs schema columns: actor_id, actor_role, action, entity_type, entity_id,
// before, after, ip, user_agent, request_id  (previously wrong: actor / entity).
const INSERT_SQL =
  `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, before, after, ip, user_agent, request_id)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;

function auditMiddleware(req, res, next) {
  const originalEnd = res.end;
  res.end = function (...args) {
    const meta = req.route?.meta?.audit;
    if (meta && res.statusCode >= 200 && res.statusCode < 300) {
      query(INSERT_SQL, [
        req.user?.id || null,
        req.user?.roleName || null,
        meta.action || 'UNKNOWN',
        meta.entity || 'UNKNOWN',
        meta.entityId || null,
        meta.before ? JSON.stringify(redactSensitive(meta.before)) : null,
        meta.after ? JSON.stringify(redactSensitive(meta.after)) : null,
        req.ip,
        req.headers['user-agent'] || null,
        req.id || null,
      ]).catch(err => console.error('Audit log error:', err.message));
    }
    return originalEnd.apply(res, args);
  };
  next();
}

// writeAudit now accepts an optional tx client so the audit row commits in the SAME
// transaction as the mutation it records (Finding 23).
async function writeAudit({ actor, actorRole, action, entityType, entity, entityId, before, after, ip, userAgent, requestId }, client) {
  const runner = client ? client.query.bind(client) : query;
  return runner(INSERT_SQL, [
    actor || null,
    actorRole || null,
    action,
    entityType || entity || 'UNKNOWN',
    entityId != null ? String(entityId) : null,
    before ? JSON.stringify(redactSensitive(before)) : null,
    after ? JSON.stringify(redactSensitive(after)) : null,
    ip || null,
    userAgent || null,
    requestId || null,
  ]);
}

module.exports = { auditMiddleware, writeAudit, redactSensitive };
