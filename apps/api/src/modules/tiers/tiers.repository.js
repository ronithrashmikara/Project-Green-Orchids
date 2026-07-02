const { query } = require('../../config/db');

const mapRow = (r) => ({
  id: r.id,
  name: r.name,
  discount: Number(r.discount_rate),
  creditLimit: Number(r.credit_cap),
  paymentTerms: r.payment_terms,
  minOrders: r.min_orders,
  priority: r.priority,
});

const repo = {
  async findAll() {
    const r = await query('SELECT * FROM buyer_tiers ORDER BY priority, id');
    return r.rows.map(mapRow);
  },
  async findById(id) {
    const r = await query('SELECT * FROM buyer_tiers WHERE id = $1', [id]);
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  },
  async create(data) {
    const r = await query(
      `INSERT INTO buyer_tiers (name, discount_rate, credit_cap, payment_terms, min_orders)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.discount, data.creditLimit, data.paymentTerms, data.minOrders]
    );
    return mapRow(r.rows[0]);
  },
  async update(id, data) {
    const fields = [];
    const values = [];
    let p = 1;
    if (data.name !== undefined) { fields.push(`name = $${p++}`); values.push(data.name); }
    if (data.discount !== undefined) { fields.push(`discount_rate = $${p++}`); values.push(data.discount); }
    if (data.creditLimit !== undefined) { fields.push(`credit_cap = $${p++}`); values.push(data.creditLimit); }
    if (data.paymentTerms !== undefined) { fields.push(`payment_terms = $${p++}`); values.push(data.paymentTerms); }
    if (data.minOrders !== undefined) { fields.push(`min_orders = $${p++}`); values.push(data.minOrders); }
    if (!fields.length) return this.findById(id);
    const r = await query(`UPDATE buyer_tiers SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`, [...values, id]);
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  },
  async remove(id) {
    await query('DELETE FROM buyer_tiers WHERE id = $1', [id]);
  },
  async countBuyersOnTier(id) {
    const r = await query('SELECT COUNT(*) FROM trade_accounts WHERE tier_id = $1', [id]);
    return parseInt(r.rows[0].count, 10);
  },
};
module.exports = repo;
