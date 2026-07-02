const { query } = require('../../config/db');
const repo = {
  async accountIdForUser(userId) {
    const r = await query(`SELECT id FROM trade_accounts WHERE user_id = $1`, [userId]);
    return r.rows[0] || null;
  },
  async nextRmaNumber() { const r = await query("SELECT nextval('rma_number_seq') as num"); return `RMA-${String(r.rows[0].num).padStart(6, '0')}`; },
  async create(client, data) {
    const run = client ? client.query.bind(client) : query;
    const r = await run(
      `INSERT INTO rma_requests (rma_no, order_id, buyer_id, status, reason_category, reason_detail)
       VALUES ($1,$2,$3,'PENDING',$4,$5) RETURNING *`,
      [data.rma_no, data.order_id, data.buyer_id, data.reason_category, data.reason_detail]
    );
    const rma = r.rows[0];
    await run(
      `INSERT INTO rma_items (rma_id, order_item_id, qty) VALUES ($1,$2,$3)`,
      [rma.id, data.order_item_id, data.quantity]
    );
    return rma;
  },
  async findAll(buyerId, isAdmin, { limit, offset }) {
    let where = ''; const params = []; let p = 1;
    if (!isAdmin && buyerId) { where = `WHERE r.buyer_id = $${p++}`; params.push(buyerId); }
    const ct = await query(`SELECT COUNT(*) FROM rma_requests r ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT r.*, ta.business_name AS buyer_name, o.order_no
       FROM rma_requests r
       LEFT JOIN trade_accounts ta ON ta.id = r.buyer_id
       LEFT JOIN orders o ON o.id = r.order_id ${where}
       ORDER BY r.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async findById(id) {
    const r = await query(
      `SELECT r.*, ta.business_name AS buyer_name, u.email AS buyer_email, o.order_no
       FROM rma_requests r
       LEFT JOIN trade_accounts ta ON ta.id = r.buyer_id
       LEFT JOIN users u ON u.id = ta.user_id
       LEFT JOIN orders o ON o.id = r.order_id
       WHERE r.id = $1`, [id]
    );
    if (!r.rows.length) return null;
    const items = await query(
      `SELECT ri.qty, oi.id AS order_item_id, oi.unit_price_at_order, p.name AS product_name
       FROM rma_items ri
       LEFT JOIN order_items oi ON oi.id = ri.order_item_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE ri.rma_id = $1`,
      [id]
    );
    return { ...r.rows[0], items: items.rows };
  },
  async updateStatus(client, id, status) {
    await (client ? client.query.bind(client) : query)(`UPDATE rma_requests SET status=$1, updated_at=NOW() WHERE id=$2`, [status, id]);
  },
  async update(client, id, data) {
    const keys = Object.keys(data); if (!keys.length) return;
    const sets = keys.map((k, i) => `${k}=$${i + 2}`); const vals = keys.map(k => data[k]);
    await (client ? client.query.bind(client) : query)(`UPDATE rma_requests SET ${sets.join(',')}, updated_at=NOW() WHERE id=$1`, [id, ...vals]);
  },
};
module.exports = repo;
