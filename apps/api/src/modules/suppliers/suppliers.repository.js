const { query } = require('../../config/db');
const repo = {
  async findAll({ limit, offset, sort, order, search }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (search) { where += ` AND (name ILIKE $${p} OR email ILIKE $${p} OR contact_person ILIKE $${p})`; params.push(`%${search}%`); p++; }
    const ct = await query(`SELECT COUNT(*) FROM suppliers ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(`SELECT * FROM suppliers ${where} ORDER BY ${sort === 'name' ? 'name' : 'created_at'} ${order} LIMIT $${p++} OFFSET $${p++}`, [...params, limit, offset]);
    return { rows: r.rows, total };
  },
  async findById(id) { const r = await query('SELECT * FROM suppliers WHERE id = $1', [id]); return r.rows[0] || null; },
  async create(data) { const r = await query('INSERT INTO suppliers (name, contact_person, email, phone, address, payment_terms, lead_time_days, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [data.name, data.contact_person, data.email, data.phone, data.address, data.payment_terms, data.lead_time_days, data.notes]); return r.rows[0]; },
  async update(id, data) { const keys = Object.keys(data); if (!keys.length) return; const sets = keys.map((k,i)=>`${k}=$${i+2}`); const values = keys.map(k=>data[k]); const r = await query(`UPDATE suppliers SET ${sets.join(',')}, updated_at=NOW() WHERE id=$1 RETURNING *`, [id, ...values]); return r.rows[0]; },
  async remove(id) { await query('DELETE FROM suppliers WHERE id = $1', [id]); },
  async findProducts(supplierId, { limit, offset }) {
    const ct = await query('SELECT COUNT(*) FROM products WHERE supplier_id = $1', [supplierId]);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query('SELECT * FROM products WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [supplierId, limit, offset]);
    return { rows: r.rows, total };
  },
};
module.exports = repo;
