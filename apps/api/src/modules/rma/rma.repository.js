const { query } = require('../../config/db');
const repo = {
  async nextRmaNumber() { const r = await query("SELECT nextval('rma_number_seq') as num"); return `RMA-${String(r.rows[0].num).padStart(6,'0')}`; },
  async create(client, data) {
    const r = await (client || query)(
      `INSERT INTO rma (rma_number, order_id, order_item_id, buyer_id, quantity, reason, return_type, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8) RETURNING *`,
      [data.rma_number, data.order_id, data.order_item_id, data.buyer_id, data.quantity, data.reason, data.return_type, data.notes]
    );
    return r.rows[0];
  },
  async findAll(buyerId, isAdmin, { limit, offset }) {
    let where = ''; const params = []; let p = 1;
    if (!isAdmin && buyerId) { where = `WHERE r.buyer_id = $${p++}`; params.push(buyerId); }
    const ct = await query(`SELECT COUNT(*) FROM rma r ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT r.*, u.name as buyer_name, o.order_number FROM rma r
       LEFT JOIN users u ON u.id = r.buyer_id LEFT JOIN orders o ON o.id = r.order_id ${where}
       ORDER BY r.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async findById(id) {
    const r = await query(
      `SELECT r.*, u.name as buyer_name, o.order_number, oi.unit_price_at_order, p.name as product_name
       FROM rma r LEFT JOIN users u ON u.id = r.buyer_id LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN order_items oi ON oi.id = r.order_item_id LEFT JOIN products p ON p.id = oi.product_id
       WHERE r.id = $1`, [id]
    );
    return r.rows[0] || null;
  },
  async updateStatus(client, id, status) { await (client || query)('UPDATE rma SET status=$1,updated_at=NOW() WHERE id=$2', [status, id]); },
  async update(client, id, data) {
    const keys = Object.keys(data); if (!keys.length) return;
    const sets = keys.map((k,i)=>`${k}=$${i+2}`); const vals = keys.map(k=>data[k]);
    await (client || query)(`UPDATE rma SET ${sets.join(',')},updated_at=NOW() WHERE id=$1`,[id,...vals]);
  },
};
module.exports = repo;
