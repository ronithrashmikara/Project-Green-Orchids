const { query, tx } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const run = (client, text, params) => (client ? client.query(text, params) : query(text, params));

const authRepository = {
  async findUserByEmail(email) {
    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.status, u.role_id, u.full_name AS name,
              r.name AS role, ta.account_status AS trade_account_status
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN trade_accounts ta ON ta.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  },

  async findUserById(id) {
    const result = await query(
      `SELECT u.id, u.email, u.status, u.role_id, u.full_name AS name, NULL::text AS phone,
              r.name AS role, ta.account_status AS trade_account_status,
              bt.name AS tier, ta.business_name, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN trade_accounts ta ON ta.user_id = u.id
       LEFT JOIN buyer_tiers bt ON bt.id = ta.tier_id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async createUser(client, { email, passwordHash, name, roleId = null }) {
    const result = await run(client,
      `INSERT INTO users (email, password_hash, full_name, status, role_id)
       VALUES ($1, $2, $3, 'ACTIVE', COALESCE($4, (SELECT id FROM roles WHERE name = 'TRADE_BUYER')))
       RETURNING id, email, full_name AS name, status, role_id, created_at`,
      [email.toLowerCase(), passwordHash, name, roleId]
    );
    return result.rows[0];
  },

  async createTradeAccount(client, { userId, businessName, businessRegNo, phone, addressLine1, addressLine2, city, district, postalCode }) {
    const address = [addressLine1, addressLine2, city, district, postalCode].filter(Boolean).join(', ');
    const result = await run(client,
      `INSERT INTO trade_accounts (user_id, business_name, business_reg_no, phone, address, tier_id, credit_limit, payment_term, account_status)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM buyer_tiers ORDER BY priority, id LIMIT 1), 0, 'NET_30', 'PENDING_APPROVAL')
       RETURNING *`,
      [userId, businessName, businessRegNo, phone, address]
    );
    return result.rows[0];
  },

  async createEmailToken(client, { userId, token, type, expiresAt }) {
    const purpose = type === 'PASSWORD_RESET' ? 'password_reset' : type === 'INVITATION' ? 'invitation' : 'email_verify';
    const result = await run(client,
      `INSERT INTO email_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, token, purpose, expiresAt]
    );
    return result.rows[0];
  },

  async findEmailToken(token, type) {
    const purpose = type === 'PASSWORD_RESET' ? 'password_reset' : type === 'INVITATION' ? 'invitation' : 'email_verify';
    const result = await query(
      `SELECT * FROM email_tokens WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()`,
      [token, purpose]
    );
    return result.rows[0] || null;
  },

  async markTokenUsed(client, tokenId) {
    await run(client,
      `UPDATE email_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenId]
    );
  },

  async verifyUserEmail(client, userId) {
    await run(client,
      `UPDATE users SET status = 'ACTIVE', email_verified_at = NOW() WHERE id = $1`,
      [userId]
    );
  },

  async createSession(client, { userId, refreshTokenHash, deviceInfo, ip, expiresAt }) {
    const result = await run(client,
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, device_label, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, refreshTokenHash, deviceInfo, deviceInfo, ip, expiresAt]
    );
    return result.rows[0];
  },

  async findSessionByRefreshToken(refreshTokenHash) {
    const result = await query(
      `SELECT *, user_agent AS device_info, ip AS ip_address
       FROM auth_sessions
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [refreshTokenHash]
    );
    return result.rows[0] || null;
  },

  async revokeSession(client, sessionId) {
    await run(client,
      `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1`,
      [sessionId]
    );
  },

  async revokeAllUserSessions(client, userId) {
    await run(client,
      `UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  },

  async countActiveSessions(userId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async removeOldestSession(client, userId) {
    await run(client,
      `UPDATE auth_sessions SET revoked_at = NOW()
       WHERE id = (
         SELECT id FROM auth_sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at ASC LIMIT 1
       )`,
      [userId]
    );
  },

  async recordLoginHistory(client, { userId, ip, userAgent, success, failureReason }) {
    await run(client,
      `INSERT INTO login_history (user_id, email_attempted, ip, user_agent, success, failure_reason)
       VALUES ($1, COALESCE((SELECT email::text FROM users WHERE id = $1), 'unknown'), $2, $3, $4, $5)`,
      [userId, ip, userAgent, success, failureReason]
    );
  },

  async countRecentFailures(userId, sinceMinutes = 15) {
    const result = await query(
      `SELECT COUNT(*) as count FROM login_history
       WHERE user_id = $1 AND success = false AND occurred_at > NOW() - INTERVAL '1 minute' * $2`,
      [userId, sinceMinutes]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async getPermissions(userId) {
    const result = await query(
      `SELECT p.code FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       INNER JOIN users u ON u.role_id = rp.role_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows.map(r => r.code);
  },

  async getUserWithProfile(userId) {
    const result = await query(
      `SELECT u.id, u.email, u.full_name AS name, NULL::text AS phone, u.status, u.role_id, u.email_verified_at, u.created_at,
              r.name as role_name,
              ta.id as trade_account_id, ta.business_name, ta.business_reg_no, ta.account_status as trade_account_status,
              ta.credit_limit, ta.payment_term AS payment_terms, bt.name AS tier,
              ta.address AS address_line1, NULL::text AS address_line2, NULL::text AS city, NULL::text AS district, NULL::text AS postal_code
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN trade_accounts ta ON ta.user_id = u.id
       LEFT JOIN buyer_tiers bt ON bt.id = ta.tier_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  async updateUserPassword(client, userId, passwordHash) {
    await run(client,
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, userId]
    );
  },

  async updateUserProfile(userId, updates) {
    const keys = Object.keys(updates);
    if (!keys.length) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map(k => updates[k]);
    await query(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1`,
      [userId, ...values]
    );
  },

  async updateTradeAccountProfile(userId, updates) {
    const keys = Object.keys(updates);
    if (!keys.length) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map(k => updates[k]);
    await query(
      `UPDATE trade_accounts SET ${setClauses.join(', ')}, updated_at = NOW() WHERE user_id = $1`,
      [userId, ...values]
    );
  },

  async getActiveSessions(userId) {
    const result = await query(
      `SELECT id, user_agent AS device_info, ip AS ip_address, created_at, expires_at
       FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async revokeSessionById(userId, sessionId) {
    const result = await query(
      `UPDATE auth_sessions SET revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [sessionId, userId]
    );
    return result.rows[0] || null;
  },

  async getUserSummary(userId) {
    const result = await query(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE buyer_id = ta.id) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE buyer_id = ta.id AND status IN ('APPROVED','PROCESSING','READY_TO_SHIP','DISPATCHED')) as active_orders,
        (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE buyer_id = ta.id AND status IN ('PENDING','PARTIALLY_PAID','OVERDUE')) as total_outstanding,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE buyer_id = ta.id AND status IN ('APPROVED','PROCESSING','READY_TO_SHIP','DISPATCHED','DELIVERED')) as total_spend
       FROM trade_accounts ta
       WHERE ta.user_id = $1`,
      [userId]
    );
    return result.rows[0] || { total_orders: 0, active_orders: 0, total_outstanding: 0, total_spend: 0 };
  },
};

module.exports = authRepository;
