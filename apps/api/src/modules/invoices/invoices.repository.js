const { query } = require('../../config/db');
const repo = {
  async findAll(buyerId, isAdmin, filters, { limit, offset, sort, order }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (!isAdmin && buyerId) { where += ` AND i.buyer_id = $${p++}`; params.push(buyerId); }
    if (filters.status) { where += ` AND i.status = $${p++}`; params.push(filters.status); }
    if (filters.order_id) { where += ` AND i.order_id = $${p++}`; params.push(filters.order_id); }
    if (filters.due_before) { where += ` AND i.due_date <= $${p++}`; params.push(filters.due_before); }
    const ct = await query(`SELECT COUNT(*) FROM invoices i ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT i.*, u.name as buyer_name, o.order_number FROM invoices i
       LEFT JOIN users u ON u.id = i.buyer_id LEFT JOIN orders o ON o.id = i.order_id ${where}
       ORDER BY i.${sort === 'due_date' ? 'due_date' : sort === 'total_amount' ? 'total_amount' : 'created_at'} ${order}
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async findById(id) {
    const r = await query(
      `SELECT i.*, u.name as buyer_name, u.email as buyer_email, o.order_number,
              ta.business_name, ta.credit_limit
       FROM invoices i LEFT JOIN users u ON u.id = i.buyer_id
       LEFT JOIN orders o ON o.id = i.order_id
       LEFT JOIN trade_accounts ta ON ta.user_id = i.buyer_id WHERE i.id = $1`, [id]
    );
    return r.rows[0] || null;
  },
  async findPayments(invoiceId) {
    const r = await query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC', [invoiceId]);
    return r.rows;
  },
  async findAdjustments(invoiceId) {
    const r = await query('SELECT * FROM invoice_adjustments WHERE invoice_id = $1 ORDER BY created_at DESC', [invoiceId]);
    return r.rows;
  },
  async getAgingReport(asOf) {
    const r = await query(
      `SELECT i.buyer_id, u.name as buyer_name, ta.business_name,
              COUNT(i.id) as invoice_count,
              COALESCE(SUM(i.balance_due), 0) as total_outstanding,
              COALESCE(SUM(CASE WHEN i.due_date < $1 - INTERVAL '90 days' THEN i.balance_due ELSE 0 END), 0) as bucket_90plus,
              COALESCE(SUM(CASE WHEN i.due_date >= $1 - INTERVAL '90 days' AND i.due_date < $1 - INTERVAL '60 days' THEN i.balance_due ELSE 0 END), 0) as bucket_60_90,
              COALESCE(SUM(CASE WHEN i.due_date >= $1 - INTERVAL '60 days' AND i.due_date < $1 - INTERVAL '30 days' THEN i.balance_due ELSE 0 END), 0) as bucket_30_60,
              COALESCE(SUM(CASE WHEN i.due_date >= $1 - INTERVAL '30 days' AND i.due_date <= $1 THEN i.balance_due ELSE 0 END), 0) as bucket_0_30
       FROM invoices i LEFT JOIN users u ON u.id = i.buyer_id
       LEFT JOIN trade_accounts ta ON ta.user_id = i.buyer_id
       WHERE i.status IN ('ISSUED','PARTIALLY_PAID','OVERDUE') AND i.balance_due > 0
       GROUP BY i.buyer_id, u.name, ta.business_name ORDER BY total_outstanding DESC`,
      [asOf]
    );
    return r.rows;
  },
  async getStatement(buyerId, year, month) {
    const r = await query(
      `SELECT * FROM invoices WHERE buyer_id = $1
       AND EXTRACT(YEAR FROM created_at) = $2 AND EXTRACT(MONTH FROM created_at) = $3
       ORDER BY created_at`,
      [buyerId, year, month]
    );
    return r.rows;
  },
  async updateStatus(client, id, status) {
    await (client || query)('UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
  },
  async updateBalanceDue(client, id, balanceDue) {
    await (client || query)('UPDATE invoices SET balance_due = $1, updated_at = NOW() WHERE id = $2', [balanceDue, id]);
  },
};
module.exports = repo;
