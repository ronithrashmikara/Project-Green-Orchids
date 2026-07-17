const { query } = require('../../config/db');

const repo = {
  async findLogins(filters, { limit, offset }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.user) { where += ` AND lh.email_attempted ILIKE $${p++}`; params.push(`%${filters.user}%`); }
    if (filters.outcome === 'SUCCESS') { where += ` AND lh.success = true`; }
    if (filters.outcome === 'FAILURE') { where += ` AND lh.success = false`; }
    if (filters.ip) { where += ` AND lh.ip = $${p++}::inet`; params.push(filters.ip); }
    if (filters.dateFrom) { where += ` AND lh.occurred_at >= $${p++}`; params.push(filters.dateFrom); }
    if (filters.dateTo) { where += ` AND lh.occurred_at <= $${p++}`; params.push(filters.dateTo); }
    const ct = await query(`SELECT COUNT(*) FROM login_history lh ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT lh.id, lh.email_attempted AS email, lh.ip,
              CASE WHEN lh.success THEN 'SUCCESS' ELSE 'FAILURE' END AS outcome,
              lh.failure_reason AS "failureReason", lh.user_agent AS "userAgent",
              lh.occurred_at AS "timestamp"
       FROM login_history lh ${where}
       ORDER BY lh.occurred_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },

  async findActiveSessions() {
    const r = await query(
      `SELECT s.id, u.email, s.ip, s.user_agent AS "userAgent", s.issued_at AS "createdAt"
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
       ORDER BY s.issued_at DESC`
    );
    return r.rows;
  },

  async forceLogout(sessionId, actor) {
    await query(
      `UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'ADMIN_FORCE_LOGOUT' WHERE id = $1 AND revoked_at IS NULL`,
      [sessionId]
    );
  },

  // Matches the real lockout check in auth.service.js login(): >=5 failures in the last 15
  // minutes, ignoring anything at/before the user's last admin unlock (users.locked_until,
  // repurposed as a "cleared as of" marker rather than an active-lock flag).
  async findLockedAccounts() {
    const r = await query(
      `SELECT u.id, u.email, COUNT(*) AS "failedAttempts", MAX(lh.occurred_at) + INTERVAL '15 minutes' AS "lockedAt"
       FROM login_history lh
       JOIN users u ON u.id = lh.user_id
       WHERE lh.success = false
         AND lh.occurred_at > GREATEST(NOW() - INTERVAL '15 minutes', COALESCE(u.locked_until, '-infinity'))
       GROUP BY u.id, u.email
       HAVING COUNT(*) >= 5
       ORDER BY MAX(lh.occurred_at) DESC`
    );
    return r.rows;
  },

  async unlockAccount(userId) {
    // Marks "cleared as of now" — countRecentFailures ignores any failure at/before this
    // timestamp, so the account can log in again immediately without losing login_history.
    await query(
      `UPDATE users SET locked_until = NOW() WHERE id = $1`,
      [userId]
    );
  },

  async findAuditLogs(filters, { limit, offset }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.actor) { where += ` AND u.email ILIKE $${p++}`; params.push(`%${filters.actor}%`); }
    if (filters.action) { where += ` AND al.action ILIKE $${p++}`; params.push(`%${filters.action}%`); }
    if (filters.entity) { where += ` AND al.entity_type ILIKE $${p++}`; params.push(`%${filters.entity}%`); }
    if (filters.dateFrom) { where += ` AND al.occurred_at >= $${p++}`; params.push(filters.dateFrom); }
    if (filters.dateTo) { where += ` AND al.occurred_at <= $${p++}`; params.push(filters.dateTo); }
    const ct = await query(`SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT al.id, COALESCE(u.email, al.actor_role, 'system') AS actor, al.action,
              al.entity_type AS entity, al.entity_id AS "entityId",
              al.before, al.after, al.occurred_at AS "timestamp"
       FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id ${where}
       ORDER BY al.occurred_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },

  async getSettings(keys) {
    const r = await query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
    return new Map(r.rows.map(row => [row.key, row.value]));
  },

  async setSetting(key, value) {
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  },
};
module.exports = repo;
