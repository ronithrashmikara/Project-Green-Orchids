const { query } = require('../../config/db');

const buyersRepository = {
  async findAll(filters, { limit, offset, sort, order }) {
    let where = 'WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (filters.status) { where += ` AND ta.account_status = $${pIdx++}`; params.push(filters.status); }
    if (filters.tier) { where += ` AND ta.tier = $${pIdx++}`; params.push(filters.tier); }
    if (filters.search) { where += ` AND (u.name ILIKE $${pIdx} OR ta.business_name ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`; params.push(`%${filters.search}%`); pIdx++; }

    const countResult = await query(
      `SELECT COUNT(*) FROM users u
       INNER JOIN trade_accounts ta ON ta.user_id = u.id ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT u.id, u.email, u.name, u.status as user_status, u.created_at,
              ta.id as trade_account_id, ta.business_name, ta.business_reg_no, ta.phone,
              ta.account_status, ta.credit_limit, ta.payment_terms, ta.tier,
              ta.address_line1, ta.city, ta.district,
              (SELECT COALESCE(SUM(balance_due),0) FROM invoices WHERE buyer_id = u.id AND status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')) as outstanding_balance,
              (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE buyer_id = u.id AND status = 'APPROVED') as total_spend
       FROM users u
       INNER JOIN trade_accounts ta ON ta.user_id = u.id ${where}
       ORDER BY ${sort === 'name' ? 'u.name' : sort === 'business_name' ? 'ta.business_name' : sort === 'credit_limit' ? 'ta.credit_limit' : 'ta.created_at'} ${order}
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );
    return { rows: result.rows, total };
  },

  async findById(userId) {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.phone, u.status as user_status, u.email_verified_at, u.created_at,
              ta.id as trade_account_id, ta.business_name, ta.business_reg_no, ta.phone as trade_phone,
              ta.account_status, ta.credit_limit, ta.available_credit, ta.payment_terms, ta.tier,
              ta.address_line1, ta.address_line2, ta.city, ta.district, ta.postal_code,
              ta.approved_at, ta.approved_by, ta.created_at as account_created_at,
              (SELECT COALESCE(SUM(balance_due),0) FROM invoices WHERE buyer_id = u.id AND status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')) as outstanding_balance
       FROM users u
       LEFT JOIN trade_accounts ta ON ta.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  async approve(client, { userId, tier, creditLimit, paymentTerms, approvedBy }) {
    await (client || query)(
      `UPDATE trade_accounts SET account_status = 'APPROVED', tier = $1, credit_limit = $2, available_credit = $2,
       payment_terms = $3, approved_by = $4, approved_at = NOW(), updated_at = NOW()
       WHERE user_id = $5`,
      [tier, creditLimit, paymentTerms, approvedBy, userId]
    );
  },

  async reject(client, { userId, reason }) {
    await (client || query)(
      `UPDATE trade_accounts SET account_status = 'REJECTED', rejection_reason = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [reason, userId]
    );
  },

  async suspend(client, { userId, reason }) {
    await (client || query)(
      `UPDATE trade_accounts SET account_status = 'SUSPENDED', suspension_reason = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [reason, userId]
    );
  },

  async reactivate(client, userId) {
    await (client || query)(
      `UPDATE trade_accounts SET account_status = 'APPROVED', updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  },

  async updateCredit(client, { userId, creditLimit }) {
    await (client || query)(
      `UPDATE trade_accounts SET credit_limit = $1, available_credit = available_credit + ($1 - credit_limit), updated_at = NOW()
       WHERE user_id = $2`,
      [creditLimit, userId]
    );
  },

  async updateTier(client, { userId, tier }) {
    await (client || query)(
      `UPDATE trade_accounts SET tier = $1, updated_at = NOW() WHERE user_id = $2`,
      [tier, userId]
    );
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
      `SELECT p.*, i.invoice_number FROM payments p
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
