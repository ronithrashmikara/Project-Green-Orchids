const { query } = require('../../config/db');

const buyersRepository = {
  async findAll(filters, { limit, offset, sort, order }) {
    let where = 'WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (filters.status) { where += ` AND ta.account_status = $${pIdx++}`; params.push(filters.status); }
    if (filters.tier) { where += ` AND bt.name = $${pIdx++}`; params.push(filters.tier); }
    if (filters.search) { where += ` AND (u.full_name ILIKE $${pIdx} OR ta.business_name ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`; params.push(`%${filters.search}%`); pIdx++; }

    const countResult = await query(
      `SELECT COUNT(*) FROM users u
       INNER JOIN trade_accounts ta ON ta.user_id = u.id
       LEFT JOIN buyer_tiers bt ON bt.id = ta.tier_id ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT u.id, u.email, u.full_name AS name, u.status as user_status, u.created_at,
              ta.id as trade_account_id, ta.business_name, ta.business_reg_no, ta.phone,
              ta.account_status, ta.credit_limit, ta.payment_term, ta.tier_id, bt.name as tier,
              ta.address, ta.approved_at, ta.approved_by,
              (SELECT COALESCE(SUM(balance_due),0) FROM invoices WHERE buyer_id = u.id AND status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')) as outstanding_balance,
              (SELECT COALESCE(SUM(total),0) FROM orders WHERE buyer_id = u.id AND status = 'APPROVED') as total_spend
       FROM users u
       INNER JOIN trade_accounts ta ON ta.user_id = u.id
       LEFT JOIN buyer_tiers bt ON bt.id = ta.tier_id ${where}
       ORDER BY ${sort === 'name' ? 'u.full_name' : sort === 'business_name' ? 'ta.business_name' : sort === 'credit_limit' ? 'ta.credit_limit' : 'ta.created_at'} ${order}
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );
    return { rows: result.rows, total };
  },

  async findById(userId) {
    const result = await query(
      `SELECT u.id, u.email, u.full_name AS name, NULL::text AS phone, u.status as user_status, u.email_verified_at, u.created_at,
              ta.id as trade_account_id, ta.business_name, ta.business_reg_no, ta.phone as trade_phone,
              ta.account_status, ta.credit_limit, ta.payment_term, ta.tier_id, bt.name as tier,
              ta.address, ta.approved_at, ta.approved_by, ta.created_at as account_created_at,
              (SELECT COALESCE(SUM(balance_due),0) FROM invoices WHERE buyer_id = u.id AND status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')) as outstanding_balance
       FROM users u
       LEFT JOIN trade_accounts ta ON ta.user_id = u.id
       LEFT JOIN buyer_tiers bt ON bt.id = ta.tier_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  async approve(client, { userId, tier, creditLimit, paymentTerms, approvedBy }) {
    const tierRes = await query('SELECT id FROM buyer_tiers WHERE name = $1', [tier]);
    const tierId = tierRes.rows[0]?.id;
    await (client ? client.query.bind(client) : query)(
      `UPDATE trade_accounts SET account_status = 'ACTIVE', tier_id = $1, credit_limit = $2,
       payment_term = $3, approved_by = $4, approved_at = NOW(), updated_at = NOW()
       WHERE user_id = $5`,
      [tierId, creditLimit, paymentTerms || 'NET_30', approvedBy, userId]
    );
  },

  async reject(client, { userId, reason }) {
    await (client ? client.query.bind(client) : query)(
      `UPDATE trade_accounts SET account_status = 'CLOSED', updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  },

  async suspend(client, { userId, reason }) {
    await (client ? client.query.bind(client) : query)(
      `UPDATE trade_accounts SET account_status = 'SUSPENDED', updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  },

  async reactivate(client, userId) {
    await (client ? client.query.bind(client) : query)(
      `UPDATE trade_accounts SET account_status = 'ACTIVE', updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  },

  async updateCredit(client, { userId, creditLimit }) {
    await (client ? client.query.bind(client) : query)(
      `UPDATE trade_accounts SET credit_limit = $1, updated_at = NOW() WHERE user_id = $2`,
      [creditLimit, userId]
    );
  },

  async updateTier(client, { userId, tier }) {
    const tierRes = await query('SELECT id FROM buyer_tiers WHERE name = $1', [tier]);
    const tierId = tierRes.rows[0]?.id;
    if (!tierId) return;
    await (client ? client.query.bind(client) : query)(
      `UPDATE trade_accounts SET tier_id = $1, updated_at = NOW() WHERE user_id = $2`,
      [tierId, userId]
    );
  },

  // R-P0-7: resolve a user's trade_accounts.id (payments/invoices key on this
  // id-space, not users.id) for ownership scoping.
  async findTradeAccountIdForUser(userId) {
    const r = await query('SELECT id FROM trade_accounts WHERE user_id = $1', [userId]);
    return r.rows.length ? String(r.rows[0].id) : null;
  },
  async findRelatedOrders(userId, { limit, offset }) {
    const countResult = await query('SELECT COUNT(*) FROM orders WHERE buyer_id = $1', [userId]);
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await query(
      `SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return { rows: result.rows, total };
  },

  async findRelatedInvoices(userId, { limit, offset }) {
    const countResult = await query('SELECT COUNT(*) FROM invoices WHERE buyer_id = $1', [userId]);
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await query(
      `SELECT * FROM invoices WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return { rows: result.rows, total };
  },

  async findRelatedPayments(userId, { limit, offset }) {
    const countResult = await query('SELECT COUNT(*) FROM payments WHERE buyer_id = $1', [userId]);
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await query(
      `SELECT p.*, i.invoice_no FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       WHERE p.buyer_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return { rows: result.rows, total };
  },

  async findRelatedRMAs(userId, { limit, offset }) {
    const countResult = await query('SELECT COUNT(*) FROM rma WHERE buyer_id = $1', [userId]);
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await query(
      `SELECT * FROM rma WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return { rows: result.rows, total };
  },
};

module.exports = buyersRepository;
