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
  async lockPayment(client, id) {
    const r = await client.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [id]);
    return r.rows[0] || null;
  },
  // Reversal detected via reversed_at (no status column in schema) — Finding 6
  async markReversed(client, id, reason) {
    const r = await (client ? client.query.bind(client) : query)(
      `UPDATE payments
       SET reversed_at = NOW(), reversal_reason = $1
       WHERE id = $2 AND reversed_at IS NULL
       RETURNING *`,
      [reason, id]
    );
    return r.rows[0] || null;
  },
  async findByReference(ref) {
    const r = await query('SELECT * FROM payments WHERE reference = $1', [ref]);
    return r.rows[0] || null;
  },
  async findByReferenceForUpdate(client, ref) {
    const r = await client.query('SELECT * FROM payments WHERE reference = $1 FOR UPDATE', [ref]);
    return r.rows[0] || null;
  },
  // Idempotency backstop for manual submits (Finding S03): the DB-level
  // uq_payments_idempotent constraint is (invoice_id, method, reference), so a resubmit with a
  // trivially different reference (or no reference at all) sails right past it. This catches
  // that case by looking for an unreversed payment on the same invoice for the same amount
  // recorded in the last N seconds, regardless of method/reference.
  async findRecentDuplicate(client, invoiceId, amount, windowSeconds) {
    const runner = client ? client.query.bind(client) : query;
    const r = await runner(
      `SELECT * FROM payments
       WHERE invoice_id = $1 AND amount = $2 AND reversed_at IS NULL
         AND received_at >= NOW() - ($3 || ' seconds')::interval
       ORDER BY received_at DESC LIMIT 1`,
      [invoiceId, amount, windowSeconds]
    );
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
    const r = await client.query(
      `SELECT i.*, ta.user_id AS buyer_user_id, ta.business_name AS buyer_name, ta.phone AS buyer_phone,
              ta.address AS buyer_address, u.email AS buyer_email
       FROM invoices i
       LEFT JOIN trade_accounts ta ON ta.id = i.buyer_id
       LEFT JOIN users u ON u.id = ta.user_id
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [invoiceId]
    );
    return r.rows[0] || null;
  },
  async createGatewayTransaction(client, data) {
    const r = await client.query(
      `INSERT INTO payment_gateway_transactions
         (gateway, gateway_order_id, invoice_id, buyer_id, amount, currency, status,
          checkout_payload, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       RETURNING *`,
      [
        data.gateway || 'STRIPE',
        data.gateway_order_id,
        data.invoice_id,
        data.buyer_id,
        data.amount,
        data.currency,
        data.status || 'INITIATED',
        JSON.stringify(data.checkout_payload || {}),
        data.created_by || null,
      ]
    );
    return r.rows[0];
  },
  async lockGatewayTransactionByOrderId(client, gatewayOrderId) {
    const r = await client.query(
      `SELECT * FROM payment_gateway_transactions
       WHERE gateway_order_id = $1
       FOR UPDATE`,
      [gatewayOrderId]
    );
    return r.rows[0] || null;
  },
  async updateGatewayTransaction(client, id, data) {
    const r = await client.query(
      `UPDATE payment_gateway_transactions
       SET status = COALESCE($2, status),
           gateway_payment_id = COALESCE($3, gateway_payment_id),
           notify_payload = COALESCE($4::jsonb, notify_payload),
           status_message = COALESCE($5, status_message),
           method = COALESCE($6, method),
           checkout_payload = COALESCE($7::jsonb, checkout_payload),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.status || null,
        data.gateway_payment_id || null,
        data.notify_payload ? JSON.stringify(data.notify_payload) : null,
        data.status_message || null,
        data.method || null,
        data.checkout_payload ? JSON.stringify(data.checkout_payload) : null,
      ]
    );
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
  // Two-person rule: confirmed_by must resolve to a real, ACTIVE, permissioned user (Finding: it
  // previously only had to be present and != actor, so any fabricated UUID passed straight through)
  async findActiveUserWithPermission(userId, permissionCode) {
    const r = await query(
      `SELECT u.id FROM users u
       INNER JOIN role_permissions rp ON rp.role_id = u.role_id
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = $1 AND u.status = 'ACTIVE' AND p.code = $2`,
      [userId, permissionCode]
    );
    return r.rows[0] || null;
  },
  async findSecondApproverByEmail(email, permissionCode) {
    const r = await query(
      `SELECT u.id, u.email, u.password_hash
       FROM users u
       INNER JOIN role_permissions rp ON rp.role_id = u.role_id
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE LOWER(u.email) = LOWER($1)
         AND u.status = 'ACTIVE'
         AND p.code = $2`,
      [email, permissionCode]
    );
    return r.rows[0] || null;
  },
};
module.exports = repo;
