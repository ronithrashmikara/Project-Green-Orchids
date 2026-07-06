const { query } = require('../../config/db');
const repo = {
  async nextOrderNumber() {
    const r = await query("SELECT nextval('order_number_seq') as num");
    return `ORD-${String(r.rows[0].num).padStart(6, '0')}`;
  },
  async nextInvoiceNumber() {
    const r = await query("SELECT nextval('invoice_number_seq') as num");
    return `INV-${String(r.rows[0].num).padStart(6, '0')}`;
  },

  // Resolve a buyer's trade_accounts.id from their users.id (id-space fix, Findings 15/16)
  async accountIdForUser(userId) {
    const r = await query(
      `SELECT ta.id, ta.tier_id, ta.user_id, u.email
       FROM trade_accounts ta JOIN users u ON u.id = ta.user_id WHERE ta.user_id = $1`,
      [userId]
    );
    return r.rows[0] || null;
  },

  async create(client, data) {
    // Schema columns: order_no, buyer_id, source, status, subtotal, tier_discount_amount, total
    const r = await (client ? client.query.bind(client) : query)(
      `INSERT INTO orders (order_no, buyer_id, source, status, subtotal, tier_discount_amount, total, rfq_id)
       VALUES ($1,$2,$3,'PENDING_APPROVAL',$4,$5,$6,$7) RETURNING *`,
      [data.order_no, data.buyer_id, data.source || 'CART', data.subtotal,
       data.tier_discount_amount, data.total, data.rfq_id || null]
    );
    return r.rows[0];
  },
  async createOrderItem(client, data) {
    // Schema columns: qty, unit_price_at_order, price_source, line_total
    const r = await (client ? client.query.bind(client) : query)(
      `INSERT INTO order_items (order_id, product_id, qty, unit_price_at_order, price_source, line_total)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.order_id, data.product_id, data.qty, data.unit_price, data.price_source || 'BASE', data.line_total]
    );
    return r.rows[0];
  },
  async findAll(buyerId, isAdmin, filters, { limit, offset, sort, order }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (!isAdmin && buyerId) { where += ` AND o.buyer_id = $${p++}`; params.push(buyerId); }
    if (filters.status) { where += ` AND o.status = $${p++}`; params.push(filters.status); }
    const ct = await query(`SELECT COUNT(*) FROM orders o ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const sorts = { total: 'o.total', order_date: 'o.created_at', created_at: 'o.created_at' };
    const sortCol = sorts[sort] || 'o.created_at';
    const r = await query(
      `SELECT o.*, ta.business_name AS buyer_name FROM orders o
       LEFT JOIN trade_accounts ta ON ta.id = o.buyer_id ${where}
       ORDER BY ${sortCol} ${order} LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async findById(id) {
    // buyer_id is trade_accounts.id; join trade_accounts -> users; expose credit_limit + tier discount
    const r = await query(
      `SELECT o.*, u.full_name AS buyer_name, u.email AS buyer_email, u.id AS buyer_user_id,
              ta.credit_limit, ta.payment_term, ta.business_name,
              bt.discount_rate AS tier_discount_rate
       FROM orders o
       LEFT JOIN trade_accounts ta ON ta.id = o.buyer_id
       LEFT JOIN users u ON u.id = ta.user_id
       LEFT JOIN buyer_tiers bt ON bt.id = ta.tier_id
       WHERE o.id = $1`,
      [id]
    );
    return r.rows[0] || null;
  },
  async findItems(orderId) {
    const r = await query(
      `SELECT oi.*, oi.qty AS quantity, p.name AS product_name, p.unit_size
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
      [orderId]
    );
    return r.rows;
  },
  async updateStatus(client, id, status) {
    await (client ? client.query.bind(client) : query)('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
  },
  // Locks the order row for the duration of the transaction so two concurrent
  // approve/convert/etc. requests on the same order serialize instead of both
  // reading the same pre-transition status (FINDING-S01).
  async lockForUpdate(client, id) {
    const r = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    return r.rows[0] || null;
  },
  async setApproved(client, id, actor) {
    const r = await client.query(
      `UPDATE orders SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'PENDING_APPROVAL' RETURNING *`,
      [actor, id]
    );
    return r.rows[0] || null;
  },
  async setRejected(client, id, reason) {
    await (client ? client.query.bind(client) : query)(
      `UPDATE orders SET status='REJECTED', rejection_reason=$1, updated_at=NOW() WHERE id=$2`,
      [reason, id]
    );
  },
  async setCancelled(client, id, reason, actor) {
    await (client ? client.query.bind(client) : query)(
      `UPDATE orders SET status='CANCELLED', cancel_reason=$1, cancelled_by=$2, cancelled_at=NOW(), updated_at=NOW() WHERE id=$3`,
      [reason, actor, id]
    );
  },

  // Lock product rows; expose BOTH stock_qty and reserved_qty so availability can be computed (Finding 7)
  async lockProductsForUpdate(client, productIds) {
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const r = await client.query(
      `SELECT id, stock_qty, reserved_qty, base_price, status FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      productIds
    );
    return r.rows;
  },
  // Reservation bumps reserved_qty (leaves physical stock untouched) — the plan's invariant (Finding 7)
  async reserveStock(client, productId, qty) {
    await client.query('UPDATE products SET reserved_qty = reserved_qty + $1, updated_at = NOW() WHERE id = $2', [qty, productId]);
  },
  async releaseReservation(client, productId, qty) {
    await client.query('UPDATE products SET reserved_qty = GREATEST(reserved_qty - $1, 0), updated_at = NOW() WHERE id = $2', [qty, productId]);
  },
  // Dispatch converts a reservation to a physical out-movement (Finding 7)
  async dispatchStock(client, productId, qty) {
    await client.query(
      'UPDATE products SET stock_qty = stock_qty - $1, reserved_qty = GREATEST(reserved_qty - $1, 0), updated_at = NOW() WHERE id = $2',
      [qty, productId]
    );
  },
  async createInvoice(client, data) {
    // Schema columns: invoice_no, status PENDING, balance_due maintained
    const r = await client.query(
      `INSERT INTO invoices (invoice_no, order_id, buyer_id, total_amount, paid_amount, balance_due, due_date, status)
       VALUES ($1,$2,$3,$4,0,$5,$6,'PENDING') RETURNING *`,
      [data.invoice_no, data.order_id, data.buyer_id, data.total_amount, data.total_amount, data.due_date]
    );
    return r.rows[0];
  },
  // Cart items joined through carts (cart_items has cart_id, not buyer_id) and products.status (not is_active)
  async getCartItems(client, accountId) {
    const r = await (client ? client.query.bind(client) : query)(
      `SELECT ci.*, ci.qty AS quantity, p.id AS product_id, p.name, p.base_price,
              p.stock_qty, p.reserved_qty, p.moq, p.status
       FROM cart_items ci
       INNER JOIN carts c ON c.id = ci.cart_id
       INNER JOIN products p ON p.id = ci.product_id
       WHERE c.buyer_id = $1`,
      [accountId]
    );
    return r.rows;
  },
  async clearCart(client, accountId) {
    await (client ? client.query.bind(client) : query)(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE buyer_id = $1)',
      [accountId]
    );
  },
  // Schema columns: qty (signed), ref_table, ref_id, performed_by, note
  async createStockMovement(client, data) {
    await client.query(
      `INSERT INTO stock_movements (product_id, movement_type, qty, ref_table, ref_id, performed_by, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [data.product_id, data.movement_type, data.qty, data.ref_table, String(data.ref_id), data.performed_by, data.note]
    );
  },
  // Tier discount resolved from buyer_tiers.discount_rate via tier_id (Finding 2)
  async getBuyerTierDiscount(accountId) {
    const r = await query(
      `SELECT bt.discount_rate FROM trade_accounts ta
       JOIN buyer_tiers bt ON bt.id = ta.tier_id WHERE ta.id = $1`,
      [accountId]
    );
    return r.rows.length ? Number(r.rows[0].discount_rate) : 0;
  },
  // Available credit = credit_limit - outstanding balance (Finding 2). Locks the account row.
  async checkCredit(client, accountId, orderTotal) {
    const r = await client.query('SELECT credit_limit, payment_term FROM trade_accounts WHERE id = $1 FOR UPDATE', [accountId]);
    if (!r.rows.length) throw new Error('Trade account not found');
    const limit = Number(r.rows[0].credit_limit);
    const out = await client.query(
      `SELECT COALESCE(SUM(balance_due),0) AS outstanding FROM invoices
       WHERE buyer_id = $1 AND status IN ('PENDING','PARTIALLY_PAID','OVERDUE')`,
      [accountId]
    );
    const outstanding = Number(out.rows[0].outstanding);
    return (outstanding + orderTotal) <= limit;
  },
};
module.exports = repo;
