const { query } = require('../../config/db');
const repo = {
  async findOutbox({ limit, offset, status }) {
    let where = ''; const params = []; let p = 1;
    if (status) { where = `WHERE status = $${p++}`; params.push(status); }
    const ct = await query(`SELECT COUNT(*) FROM email_outbox ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(`SELECT * FROM email_outbox ${where} ORDER BY created_at DESC LIMIT $${p++} OFFSET $${p++}`, [...params, limit, offset]);
    return { rows: r.rows, total };
  },
  async findOutboxById(id) {
    const r = await query('SELECT * FROM email_outbox WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async updateStatus(client, id, status) { await (client || query)('UPDATE email_outbox SET status=$1,updated_at=NOW() WHERE id=$2', [status, id]); },
  async getHealthStats() {
    const r = await query(
      `SELECT status, COUNT(*) as count FROM email_outbox GROUP BY status
       UNION ALL SELECT 'TOTAL', COUNT(*) FROM email_outbox`
    );
    return r.rows;
  },
};
module.exports = repo;
