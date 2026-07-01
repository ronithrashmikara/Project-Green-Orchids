const { query } = require('../../config/db');
const repo = {
  async nextPaymentNumber() {
    const r = await query("SELECT nextval('payment_number_seq') as num");
    return `PAY-${String(r.rows[0].num).padStart(6, '0')}`;
  },
  async findAll({ limit, offset }) {
    const ct = await query('SELECT COUNT(*) FROM payments');
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT p.*, ta.business_name AS buyer_name, i.invoice_no
       FROM payments p
       LEFT JOIN trade_accounts ta ON ta.id = p.buyer_id
       LEFT JOIN invoices i ON i.id = p.invoice_id
       ORDER BY p.received_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: r.rows, total };
  },
  async sumThisMonth() {
    const r = await query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM payments
       WHERE reversed_at IS NULL AND received_at >= DATE_TRUNC('month', NOW())`
    );
    return Number(r.rows[0].total);
  },
  // Schema columns: payment_no, invoice_id, buyer_id, amount, method, reference, recorded_by, received_at
  async create(client, data) {
    const r = await (client ? client.query.bind(client) : query)(
      `INSERT INTO payments (payment_no, invoice_id, buyer_id, amount, method, reference, recorded_by, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW())) RETURNING *`,
      [data.payment_no, data.invoice_id, data.buyer_id, data.amount, data.method,
       data.reference, data.recorded_by, data.payment_date]
    );
    return r.rows[0];
  },
  async findById(id) {
    const r = await query('SELECT * FROM payments WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  // Reversal detected via reversed_at (no status column in schema) — Finding 6
  async markReversed(client, id, reason) {
    await (client ? client.query.bind(client) : query)(
      'UPDATE payments SET reversed_at = NOW(), reversal_reason = $1 WHERE id = $2',
      [reason, id]
    );
  },
  async findByReference(ref) {
    const r = await query('SELECT * FROM payments WHERE reference = $1', [ref]);
    return r.rows[0] || null;
  },
  async findInvoiceByOrderNo(orderNo) {
    const r = await query(
      `SELECT i.* FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.order_no = $1`,
      [orderNo]
    );
    return r.rows[0] || null;
  },
  async lockInvoice(client, invoiceId) {
    const r = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
    return r.rows[0] || null;
  },
  // Σ(adjustments) for an invoice — feeds balance_due (Finding 10 / F1.3)
  async sumAdjustments(client, invoiceId) {
    const runner = client ? client.query.bind(client) : query;
    const r = await runner('SELECT COALESCE(SUM(amount),0) AS s FROM invoice_adjustments WHERE invoice_id = $1', [invoiceId]);
    return Number(r.rows[0].s);
  },
  async updateInvoice(client, invoiceId, paidAmount, balanceDue, status) {
    await client.query(
      'UPDATE invoices SET paid_amount = $1, balance_due = $2, status = $3, updated_at = NOW() WHERE id = $4',
      [paidAmount, balanceDue, status, invoiceId]
    );
  },
};
module.exports = repo;
