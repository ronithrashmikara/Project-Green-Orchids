const { query } = require('../../config/db');

const usersRepository = {
  async findAll({ page, limit, offset, sort, order }) {
    const countResult = await query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await query(
      `SELECT u.id, u.email, u.name, u.status, u.role_id, u.created_at, r.name as role_name
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.${sort} ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: result.rows, total };
  },

  async findById(id) {
    const result = await query(
      `SELECT u.*, r.name as role_name,
              ta.id as trade_account_id, ta.business_name, ta.account_status, ta.credit_limit, ta.tier
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN trade_accounts ta ON ta.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async create({ email, passwordHash, name, roleId }) {
    const result = await query(
      `INSERT INTO users (email, password_hash, name, status, role_id)
       VALUES ($1, $2, $3, 'PENDING', $4) RETURNING *`,
      [email.toLowerCase(), passwordHash, name, roleId]
    );
    return result.rows[0];
  },

  async update(id, updates) {
    const keys = Object.keys(updates);
    if (!keys.length) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map(k => updates[k]);
    const result = await query(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  },

  async findLoginHistory(userId, { limit, offset }) {
    const countResult = await query('SELECT COUNT(*) FROM login_history WHERE user_id = $1', [userId]);
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await query(
      `SELECT * FROM login_history WHERE user_id = $1 ORDER BY attempted_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return { rows: result.rows, total };
  },
};

module.exports = usersRepository;
